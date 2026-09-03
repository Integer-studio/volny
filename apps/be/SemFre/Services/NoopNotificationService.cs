using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace SemFre.Services;

public class NoopNotificationService : INotificationService
{
    private readonly ILogger<NoopNotificationService> _log;
    public NoopNotificationService(ILogger<NoopNotificationService> log)
    {
        _log = log;
    }

    public Task<PushSendResult> SendToDeviceAsync(string deviceToken, NotificationMessage message, CancellationToken ct = default)
    {
        _log.LogInformation("Noop send to {token}: {title} - {body}", deviceToken, message.Title, message.Body);
        var r = new PushSendResult();
        r.AcceptedTokens.Add(deviceToken);
        return Task.FromResult(r);
    }

    public Task<PushSendResult> SendToDevicesAsync(IEnumerable<string> deviceTokens, NotificationMessage message, CancellationToken ct = default)
    {
        var list = deviceTokens?.ToList() ?? new List<string>();
        _log.LogInformation("Noop send to {count} devices: {title}", list.Count, message.Title);
        var r = new PushSendResult();
        r.AcceptedTokens.AddRange(list);
        return Task.FromResult(r);
    }
}
