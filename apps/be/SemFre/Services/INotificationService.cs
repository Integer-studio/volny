using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace SemFre.Services;

/// <summary>Outcome of one push send attempt, broken down per token.</summary>
public class PushSendResult
{
    /// <summary>Tokens accepted by the push provider.</summary>
    public List<string> AcceptedTokens { get; } = new();

    /// <summary>Tokens that are permanently dead and must be deleted from UserDevices.</summary>
    public List<string> InvalidTokens { get; } = new();

    /// <summary>Tokens whose delivery failed transiently and may be retried.</summary>
    public List<string> RetryableTokens { get; } = new();

    /// <summary>Tokens that failed permanently for a non-token reason (bad payload, etc.). Not retried.</summary>
    public List<string> PermanentlyFailedTokens { get; } = new();

    /// <summary>Human-readable summary of the last error seen, for logging / dead-letter reasons.</summary>
    public string? LastError { get; set; }
}

public interface INotificationService
{
    Task<PushSendResult> SendToDeviceAsync(string deviceToken, NotificationMessage message, CancellationToken ct = default);
    Task<PushSendResult> SendToDevicesAsync(IEnumerable<string> deviceTokens, NotificationMessage message, CancellationToken ct = default);
}
