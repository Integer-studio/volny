using System.Collections.Generic;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace SemFre.Services;

public class QueuedNotification
{
    public int? RecipientUserId { get; set; }
    public IEnumerable<string>? DeviceTokens { get; set; }
    public NotificationMessage Message { get; set; } = new NotificationMessage();
    public int RetryCount { get; set; }
    public int MaxRetries { get; set; } = 3;
    public string? LastError { get; set; }
    public System.DateTime EnqueuedAt { get; set; } = System.DateTime.UtcNow;
}

public class DeadLetterEntry
{
    public QueuedNotification Notification { get; set; } = null!;
    public string Reason { get; set; } = string.Empty;
    public System.DateTime FailedAt { get; set; } = System.DateTime.UtcNow;
}

public class NotificationQueue
{
    private readonly Channel<QueuedNotification> _channel = Channel.CreateUnbounded<QueuedNotification>();
    private readonly System.Collections.Concurrent.ConcurrentQueue<DeadLetterEntry> _deadLetters = new();
    private long _pendingCount = 0;

    public ValueTask EnqueueAsync(QueuedNotification item)
    {
        item.EnqueuedAt = System.DateTime.UtcNow;
        System.Threading.Interlocked.Increment(ref _pendingCount);
        return _channel.Writer.WriteAsync(item);
    }

    public void EnqueueDeadLetter(QueuedNotification item, string reason)
    {
        var entry = new DeadLetterEntry { Notification = item, Reason = reason, FailedAt = System.DateTime.UtcNow };
        _deadLetters.Enqueue(entry);
    }

    public (int Pending, int DeadLetterCount) GetStats()
    {
        return ((int)System.Threading.Interlocked.Read(ref _pendingCount), _deadLetters.Count);
    }

    public System.Collections.Generic.List<DeadLetterEntry> GetDeadLetters() => _deadLetters.ToList();

    public IAsyncEnumerable<QueuedNotification> DequeueAllAsync(CancellationToken ct = default)
    {
        return ReadAllAsync(ct);
    }

    private async IAsyncEnumerable<QueuedNotification> ReadAllAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        while (await _channel.Reader.WaitToReadAsync(ct))
        {
            while (_channel.Reader.TryRead(out var item))
            {
                System.Threading.Interlocked.Decrement(ref _pendingCount);
                yield return item;
            }
        }
    }
}
