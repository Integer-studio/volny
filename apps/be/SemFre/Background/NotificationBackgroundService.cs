using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SemFre.Data;
using Microsoft.EntityFrameworkCore;

namespace SemFre.Background;

public class NotificationBackgroundService : BackgroundService
{
    private readonly Services.NotificationQueue _queue;
    private readonly IServiceProvider _provider;
    private readonly Services.INotificationService _notifier;
    private readonly ILogger<NotificationBackgroundService> _log;

    public NotificationBackgroundService(Services.NotificationQueue queue, IServiceProvider provider, Services.INotificationService notifier, ILogger<NotificationBackgroundService> log)
    {
        _queue = queue;
        _provider = provider;
        _notifier = notifier;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var item in _queue.DequeueAllAsync(stoppingToken))
        {
            if (stoppingToken.IsCancellationRequested) break;

            try
            {
                List<string> tokens = item.DeviceTokens?.ToList() ?? new List<string>();
                if (tokens.Count == 0 && item.RecipientUserId.HasValue)
                {
                    using var scope = _provider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    tokens = await db.UserDevices.AsNoTracking()
                        .Where(d => d.UserID == item.RecipientUserId.Value)
                        .Select(d => d.DeviceToken)
                        .ToListAsync(stoppingToken);
                }

                if (tokens.Count == 0)
                {
                    _log.LogInformation("No device tokens found for notification to user {user}", item.RecipientUserId);
                    continue;
                }

                var result = await _notifier.SendToDevicesAsync(tokens, item.Message, stoppingToken);

                if (result.InvalidTokens.Count > 0)
                    await PruneTokensAsync(result.InvalidTokens, stoppingToken);

                if (result.PermanentlyFailedTokens.Count > 0)
                    _log.LogError("Permanently failed to deliver \"{title}\" to {count} token(s) for user {user}: {err}",
                        item.Message.Title, result.PermanentlyFailedTokens.Count, item.RecipientUserId, result.LastError);

                if (result.RetryableTokens.Count > 0)
                {
                    // Retry ONLY the tokens that failed, so already-delivered devices
                    // do not get a duplicate notification.
                    item.LastError = result.LastError;
                    item.DeviceTokens = result.RetryableTokens;
                    ScheduleRetryOrDeadLetter(item, result.LastError ?? "transient token failure", stoppingToken);
                }
            }
            catch (Services.PermanentPushException ex)
            {
                // Configuration / payload error: retrying is pointless, fail fast and loudly.
                _log.LogError(ex, "Permanent push failure for user {user}; dead-lettering immediately", item.RecipientUserId);
                item.LastError = ex.Message;
                _queue.EnqueueDeadLetter(item, ex.Message);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex) // TransientPushException, DB errors, anything unexpected
            {
                _log.LogWarning(ex, "Notification failed (retry {retry}/{max}) for user {user}",
                    item.RetryCount + 1, item.MaxRetries, item.RecipientUserId);
                item.LastError = ex.Message;
                var delayOverride = (ex as Services.TransientPushException)?.RetryAfter;
                ScheduleRetryOrDeadLetter(item, ex.Message, stoppingToken, delayOverride);
            }
        }
    }

    private void ScheduleRetryOrDeadLetter(Services.QueuedNotification item, string reason,
        CancellationToken stoppingToken, TimeSpan? delayOverride = null)
    {
        item.RetryCount++;
        if (item.RetryCount > item.MaxRetries)
        {
            _log.LogWarning("Moving notification to dead-letter after {retries} attempts: {reason}", item.RetryCount, reason);
            _queue.EnqueueDeadLetter(item, reason);
            return;
        }

        var delay = delayOverride ?? TimeSpan.FromSeconds(Math.Pow(2, item.RetryCount));
        if (delay > TimeSpan.FromMinutes(5)) delay = TimeSpan.FromMinutes(5);

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
                await _queue.EnqueueAsync(item).ConfigureAwait(false);
            }
            catch (OperationCanceledException) { /* shutting down; retry is dropped */ }
            catch (Exception inner)
            {
                _log.LogError(inner, "Failed to re-enqueue notification for user {user}", item.RecipientUserId);
            }
        }, CancellationToken.None);
    }

    private async Task PruneTokensAsync(IReadOnlyCollection<string> tokens, CancellationToken ct)
    {
        try
        {
            using var scope = _provider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var rows = await db.UserDevices.Where(d => tokens.Contains(d.DeviceToken)).ToListAsync(ct);
            if (rows.Count == 0) return;
            db.UserDevices.RemoveRange(rows);
            await db.SaveChangesAsync(ct);
            _log.LogInformation("Pruned {count} dead device token(s)", rows.Count);
        }
        catch (Exception ex)
        {
            // Pruning is best-effort; never let it fail the notification pipeline.
            _log.LogError(ex, "Failed to prune dead device tokens");
        }
    }
}
