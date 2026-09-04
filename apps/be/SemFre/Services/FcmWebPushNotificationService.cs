using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using FirebaseAdmin.Messaging;
using Microsoft.Extensions.Logging;

namespace SemFre.Services;

/// <summary>
/// Sends push notifications to browsers via the FCM HTTP v1 API (through the
/// FirebaseAdmin SDK). Pure adapter - has no database access. Token pruning based on
/// the results this returns is the caller's responsibility (see NotificationBackgroundService),
/// same contract as ExpoPushNotificationService.
/// </summary>
public class FcmWebPushNotificationService : INotificationService
{
    // FCM's sendEach/sendEachAsync accepts at most 500 messages per call.
    private const int MaxBatchSize = 500;

    // FCM does not publish a formal token grammar. Registration tokens are opaque,
    // reasonably long, URL-safe strings - this only rejects obvious garbage, the same
    // role ExpoPushNotificationService.IsValidExpoToken plays for Expo tokens.
    private static readonly Regex FcmTokenShapeRegex =
        new(@"^[A-Za-z0-9_\-:.]{50,4096}$", RegexOptions.Compiled);

    private readonly FirebaseMessaging _messaging;
    private readonly ILogger<FcmWebPushNotificationService> _log;

    public FcmWebPushNotificationService(FirebaseMessaging messaging, ILogger<FcmWebPushNotificationService> log)
    {
        _messaging = messaging;
        _log = log;
    }

    public static bool IsValidFcmWebToken(string? token) =>
        !string.IsNullOrWhiteSpace(token)
        && !ExpoPushNotificationService.IsValidExpoToken(token)
        && FcmTokenShapeRegex.IsMatch(token);

    public Task<PushSendResult> SendToDeviceAsync(string deviceToken, NotificationMessage message, CancellationToken ct = default)
        => SendToDevicesAsync(new[] { deviceToken }, message, ct);

    public async Task<PushSendResult> SendToDevicesAsync(IEnumerable<string> deviceTokens, NotificationMessage message, CancellationToken ct = default)
    {
        var result = new PushSendResult();

        var all = (deviceTokens ?? Enumerable.Empty<string>())
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (all.Count == 0) return result;

        for (var offset = 0; offset < all.Count; offset += MaxBatchSize)
        {
            ct.ThrowIfCancellationRequested();
            var chunk = all.GetRange(offset, Math.Min(MaxBatchSize, all.Count - offset));
            await SendChunkAsync(chunk, message, result, ct).ConfigureAwait(false);
        }

        return result;
    }

    private async Task SendChunkAsync(List<string> chunk, NotificationMessage message, PushSendResult result, CancellationToken ct)
    {
        var messages = chunk.Select(token => new Message
        {
            Token = token,
            Notification = new Notification { Title = message.Title, Body = message.Body },
            Data = message.Data,
            Webpush = new WebpushConfig
            {
                Headers = new Dictionary<string, string> { ["Urgency"] = "high" },
                Notification = new WebpushNotification { Title = message.Title, Body = message.Body }
            }
        }).ToList();

        BatchResponse response;
        try
        {
            response = await _messaging.SendEachAsync(messages, ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; // shutdown: let the worker loop exit
        }
        catch (FirebaseAdmin.FirebaseException ex)
        {
            // Request-level failure (bad credentials, malformed batch, ...) - no
            // per-token responses to inspect, so treat the whole chunk as one failure.
            throw ex.ErrorCode is FirebaseAdmin.ErrorCode.Unavailable
                or FirebaseAdmin.ErrorCode.DeadlineExceeded
                or FirebaseAdmin.ErrorCode.Internal
                ? new TransientPushException("FCM request failed transiently", null, ex)
                : new PermanentPushException("FCM request failed", ex);
        }
        catch (Exception ex) // transport-level: network, TLS, DNS, ...
        {
            throw new TransientPushException("FCM request failed at transport level", null, ex);
        }

        for (var i = 0; i < response.Responses.Count; i++)
        {
            var token = chunk[i];
            var item = response.Responses[i];

            if (item.IsSuccess)
            {
                result.AcceptedTokens.Add(token);
                continue;
            }

            var code = item.Exception?.MessagingErrorCode;
            result.LastError = $"{code?.ToString() ?? "unknown"}: {item.Exception?.Message}";

            switch (code)
            {
                case MessagingErrorCode.Unregistered:
                    _log.LogInformation("FCM reports Unregistered, token will be pruned: {prefix}...", Truncate(token));
                    result.InvalidTokens.Add(token);
                    break;

                case MessagingErrorCode.QuotaExceeded:
                case MessagingErrorCode.Unavailable:
                case MessagingErrorCode.Internal:
                    result.RetryableTokens.Add(token);
                    break;

                case MessagingErrorCode.InvalidArgument:
                case MessagingErrorCode.SenderIdMismatch:
                case MessagingErrorCode.ThirdPartyAuthError:
                    _log.LogError("Permanent FCM push error {code} for token {prefix}...: {msg}",
                        code, Truncate(token), item.Exception?.Message);
                    result.PermanentlyFailedTokens.Add(token);
                    break;

                default:
                    // Unknown error code: treat as retryable once, the worker caps attempts.
                    _log.LogWarning("Unknown FCM push error {code} for token {prefix}...: {msg}",
                        code, Truncate(token), item.Exception?.Message);
                    result.RetryableTokens.Add(token);
                    break;
            }
        }

        _log.LogInformation(
            "FCM web push \"{title}\": {ok} ok, {invalid} invalid, {retry} retryable, {perm} permanent (of {total})",
            message.Title, result.AcceptedTokens.Count, result.InvalidTokens.Count,
            result.RetryableTokens.Count, result.PermanentlyFailedTokens.Count, chunk.Count);
    }

    private static string Truncate(string? s, int len = 24)
        => string.IsNullOrEmpty(s) ? "" : (s.Length <= len ? s : s.Substring(0, len));
}
