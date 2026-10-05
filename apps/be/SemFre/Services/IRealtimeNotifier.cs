namespace SemFre.Services;

/// <summary>
/// Realtime refetch signals over SignalR. Events carry no data (except the
/// requester's name for the friend-request toast) - clients re-call the
/// existing REST endpoints. Call only after SaveChangesAsync; failures are
/// logged and never fail the request.
/// </summary>
public interface IRealtimeNotifier
{
    /// <summary>The user's free state changed: tells the user and all their connections.</summary>
    Task FreeChangedAsync(int userId);

    /// <summary>Who is connected to these users changed: tells each user and all their connections.</summary>
    Task ConnectionsChangedAsync(params int[] userIds);

    /// <summary>Tells exactly these users that their free list may have changed (e.g. all members of a group whose membership changed).</summary>
    Task FreeChangedForAsync(IEnumerable<int> recipientUserIds);

    /// <summary>Friend list or incoming/outgoing requests of these users changed.</summary>
    Task FriendsChangedAsync(params int[] userIds);

    Task FriendRequestReceivedAsync(int toUserId, int fromUserId, string fromName);
}
