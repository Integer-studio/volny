using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace SemFre.Services;

public class ExpoPushOptions
{
    public bool Enabled { get; set; }

    /// <summary>Optional. Only needed if "enhanced security" is enabled in the EAS dashboard.</summary>
    public string? AccessToken { get; set; }

    /// <summary>Android notification channel id; must match a channel created by the Expo client.</summary>
    public string ChannelId { get; set; } = "default";
}

/// <summary>
/// Sends push notifications via the Expo Push Service (https://exp.host/--/api/v2/push/send).
/// Pure HTTP adapter - has no database access. Token pruning based on the results
/// this returns is the caller's responsibility (see NotificationBackgroundService).
/// </summary>
public class ExpoPushNotificationService : INotificationService
{
    public const string HttpClientName = "expo";
    private const int MaxBatchSize = 100;

    // Expo emits both spellings historically; accept either.
    private static readonly Regex ExpoTokenRegex =
        new(@"^Expo(nent)?PushToken\[[^\]\s]+\]$", RegexOptions.Compiled);

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly IHttpClientFactory _httpFactory;
    private readonly ExpoPushOptions _options;
    private readonly ILogger<ExpoPushNotificationService> _log;

    public ExpoPushNotificationService(
        IHttpClientFactory httpFactory,
        ExpoPushOptions options,
        ILogger<ExpoPushNotificationService> log)
    {
        _httpFactory = httpFactory;
        _options = options;
        _log = log;
    }

    public static bool IsValidExpoToken(string? token) =>
        !string.IsNullOrWhiteSpace(token) && ExpoTokenRegex.IsMatch(token);

    public Task<PushSendResult> SendToDeviceAsync(string deviceToken, NotificationMessage message, CancellationToken ct = default)
        => SendToDevicesAsync(new[] { deviceToken }, message, ct);

    public async Task<PushSendResult> SendToDevicesAsync(IEnumerable<string> deviceTokens, NotificationMessage message, CancellationToken ct = default)
    {
        var result = new PushSendResult();

        var all = (deviceTokens ?? Enumerable.Empty<string>())
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        // Anything that is not an Expo token (e.g. a leftover raw FCM token from the
        // old flow) is permanently undeliverable via Expo - mark for deletion, never send it.
        var valid = new List<string>();
        foreach (var t in all)
        {
            if (IsValidExpoToken(t))
            {
                valid.Add(t);
            }
            else
            {
                _log.LogInformation("Discarding non-Expo push token (legacy format?): {prefix}...", Truncate(t));
                result.InvalidTokens.Add(t);
                result.LastError = "Non-Expo token format";
            }
        }
        if (valid.Count == 0) return result;

        for (var offset = 0; offset < valid.Count; offset += MaxBatchSize)
        {
            ct.ThrowIfCancellationRequested();
            var chunk = valid.GetRange(offset, Math.Min(MaxBatchSize, valid.Count - offset));
            await SendChunkAsync(chunk, message, result, ct).ConfigureAwait(false);
        }

        return result;
    }

    private async Task SendChunkAsync(List<string> chunk, NotificationMessage message, PushSendResult result, CancellationToken ct)
    {
        // One message object per token, so ticket[i] corresponds to chunk[i].
        var payload = chunk.Select(token => new ExpoPushMessage
        {
            To = token,
            Title = message.Title,
            Body = message.Body,
            Data = message.Data,
            Sound = "default",
            ChannelId = _options.ChannelId,
            Priority = "high"
        }).ToList();

        var client = _httpFactory.CreateClient(HttpClientName);
        using var req = new HttpRequestMessage(HttpMethod.Post, "--/api/v2/push/send")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload, JsonOpts), Encoding.UTF8, "application/json")
        };
        if (!string.IsNullOrWhiteSpace(_options.AccessToken))
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.AccessToken);

        HttpResponseMessage res;
        string bodyText;
        try
        {
            res = await client.SendAsync(req, ct).ConfigureAwait(false);
            bodyText = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; // shutdown: let the worker loop exit
        }
        catch (Exception ex) // HttpRequestException, timeout, DNS, TLS
        {
            throw new TransientPushException("Expo push request failed at transport level", null, ex);
        }

        using (res)
        {
            if (res.StatusCode == HttpStatusCode.TooManyRequests || (int)res.StatusCode >= 500)
            {
                var retryAfter = res.Headers.RetryAfter?.Delta
                                 ?? (res.Headers.RetryAfter?.Date is { } d ? d - DateTimeOffset.UtcNow : (TimeSpan?)null);
                throw new TransientPushException(
                    $"Expo push returned {(int)res.StatusCode}: {Truncate(bodyText, 500)}", retryAfter);
            }

            if (!res.IsSuccessStatusCode)
            {
                // 400 bad payload / 401 / 403 bad access token -> retrying cannot help.
                throw new PermanentPushException(
                    $"Expo push returned {(int)res.StatusCode}: {Truncate(bodyText, 500)}");
            }

            ExpoPushResponse? parsed;
            try
            {
                parsed = JsonSerializer.Deserialize<ExpoPushResponse>(bodyText, JsonOpts);
            }
            catch (JsonException ex)
            {
                throw new PermanentPushException("Could not parse Expo push response", ex);
            }

            if (parsed?.Errors is { Count: > 0 })
                throw new PermanentPushException(
                    "Expo push request-level error: " +
                    string.Join("; ", parsed.Errors.Select(e => $"{e.Code}: {e.Message}")));

            var tickets = parsed?.Data;
            if (tickets is null || tickets.Count != chunk.Count)
            {
                // Cannot correlate tickets to tokens - do not guess which token died.
                throw new TransientPushException(
                    $"Expo returned {tickets?.Count ?? 0} tickets for {chunk.Count} messages");
            }

            for (var i = 0; i < tickets.Count; i++)
            {
                var token = chunk[i];
                var ticket = tickets[i];

                if (string.Equals(ticket.Status, "ok", StringComparison.OrdinalIgnoreCase))
                {
                    result.AcceptedTokens.Add(token);
                    continue;
                }

                var code = ticket.Details?.Error;
                result.LastError = $"{code ?? "unknown"}: {ticket.Message}";

                switch (code)
                {
                    case "DeviceNotRegistered":
                        _log.LogInformation("Expo reports DeviceNotRegistered, token will be pruned: {prefix}...", Truncate(token));
                        result.InvalidTokens.Add(token);
                        break;

                    case "MessageRateExceeded":
                        result.RetryableTokens.Add(token);
                        break;

                    case "MessageTooBig":
                    case "InvalidCredentials":
                    case "MismatchSenderId":
                        _log.LogError("Permanent Expo push error {code} for token {prefix}...: {msg}", code, Truncate(token), ticket.Message);
                        result.PermanentlyFailedTokens.Add(token);
                        break;

                    default:
                        // Unknown error code: treat as retryable once, the worker caps attempts.
                        _log.LogWarning("Unknown Expo push error {code} for token {prefix}...: {msg}", code, Truncate(token), ticket.Message);
                        result.RetryableTokens.Add(token);
                        break;
                }
            }

            _log.LogInformation(
                "Expo push \"{title}\": {ok} ok, {invalid} invalid, {retry} retryable, {perm} permanent (of {total})",
                message.Title, result.AcceptedTokens.Count, result.InvalidTokens.Count,
                result.RetryableTokens.Count, result.PermanentlyFailedTokens.Count, chunk.Count);
        }
    }

    private static string Truncate(string? s, int len = 24)
        => string.IsNullOrEmpty(s) ? "" : (s.Length <= len ? s : s.Substring(0, len));

    // ---- wire types ----

    private sealed class ExpoPushMessage
    {
        public string To { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string? Body { get; set; }
        public Dictionary<string, string>? Data { get; set; }
        public string? Sound { get; set; }
        public string? ChannelId { get; set; }
        public string? Priority { get; set; }
    }

    private sealed class ExpoPushResponse
    {
        public List<ExpoPushTicket>? Data { get; set; }
        public List<ExpoRequestError>? Errors { get; set; }
    }

    private sealed class ExpoPushTicket
    {
        public string? Status { get; set; }
        public string? Id { get; set; }
        public string? Message { get; set; }
        public ExpoTicketDetails? Details { get; set; }
    }

    private sealed class ExpoTicketDetails
    {
        public string? Error { get; set; }
    }

    private sealed class ExpoRequestError
    {
        public string? Code { get; set; }
        public string? Message { get; set; }
    }
}
