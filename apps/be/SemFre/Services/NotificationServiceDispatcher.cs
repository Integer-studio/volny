using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SemFre.Services;

/// <summary>
/// Routes each device token to the notification service that can actually deliver it,
/// based on the token's own format (Expo tokens are unmistakably `Expo(nent)PushToken[...]`;
/// everything else is treated as an FCM web token). This is what lets
/// NotificationBackgroundService keep sending "all of a user's tokens" in one call without
/// knowing or caring which provider each one belongs to.
/// </summary>
public class NotificationServiceDispatcher : INotificationService
{
    private readonly INotificationService _expo;
    private readonly INotificationService _fcmWeb;

    public NotificationServiceDispatcher(ExpoOrNoop expo, FcmWebOrNoop fcmWeb)
    {
        _expo = expo.Service;
        _fcmWeb = fcmWeb.Service;
    }

    public Task<PushSendResult> SendToDeviceAsync(string deviceToken, NotificationMessage message, CancellationToken ct = default)
        => SendToDevicesAsync(new[] { deviceToken }, message, ct);

    public async Task<PushSendResult> SendToDevicesAsync(IEnumerable<string> deviceTokens, NotificationMessage message, CancellationToken ct = default)
    {
        var all = (deviceTokens ?? Enumerable.Empty<string>()).ToList();
        var expoTokens = all.Where(ExpoPushNotificationService.IsValidExpoToken).ToList();
        var otherTokens = all.Except(expoTokens, StringComparer.Ordinal).ToList();

        var result = new PushSendResult();
        if (expoTokens.Count > 0)
            Merge(result, await _expo.SendToDevicesAsync(expoTokens, message, ct).ConfigureAwait(false));
        if (otherTokens.Count > 0)
            Merge(result, await _fcmWeb.SendToDevicesAsync(otherTokens, message, ct).ConfigureAwait(false));

        return result;
    }

    private static void Merge(PushSendResult into, PushSendResult from)
    {
        into.AcceptedTokens.AddRange(from.AcceptedTokens);
        into.InvalidTokens.AddRange(from.InvalidTokens);
        into.RetryableTokens.AddRange(from.RetryableTokens);
        into.PermanentlyFailedTokens.AddRange(from.PermanentlyFailedTokens);
        if (from.LastError != null) into.LastError = from.LastError;
    }

    /// <summary>DI wrapper so the dispatcher can require "an Expo sender, real or no-op" as a
    /// distinct type from "an FCM web sender, real or no-op" - both wrap plain
    /// INotificationService, which alone wouldn't disambiguate them for the container.</summary>
    public class ExpoOrNoop
    {
        public INotificationService Service { get; }
        public ExpoOrNoop(INotificationService service) => Service = service;
    }

    public class FcmWebOrNoop
    {
        public INotificationService Service { get; }
        public FcmWebOrNoop(INotificationService service) => Service = service;
    }
}
