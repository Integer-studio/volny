using System;

namespace SemFre.Services;

/// <summary>Whole-request failure that is worth retrying (network, 5xx, 429).</summary>
public class TransientPushException : Exception
{
    public TimeSpan? RetryAfter { get; }

    public TransientPushException(string message, TimeSpan? retryAfter = null, Exception? inner = null)
        : base(message, inner) => RetryAfter = retryAfter;
}

/// <summary>Whole-request failure that will never succeed on retry (400, 401, 403, malformed response).</summary>
public class PermanentPushException : Exception
{
    public PermanentPushException(string message, Exception? inner = null) : base(message, inner) { }
}
