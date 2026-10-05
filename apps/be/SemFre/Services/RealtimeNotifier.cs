using Microsoft.AspNetCore.SignalR;
using SemFre.Hubs;

namespace SemFre.Services;

public class RealtimeNotifier : IRealtimeNotifier
{
    private readonly IHubContext<RealtimeHub> _hub;
    private readonly IConnectionService _connections;
    private readonly ILogger<RealtimeNotifier> _log;

    public RealtimeNotifier(IHubContext<RealtimeHub> hub, IConnectionService connections, ILogger<RealtimeNotifier> log)
    {
        _hub = hub;
        _connections = connections;
        _log = log;
    }

    public Task FreeChangedAsync(int userId) => ConnectionsChangedAsync(userId);

    public async Task ConnectionsChangedAsync(params int[] userIds)
    {
        try
        {
            var recipients = new HashSet<int>(userIds);
            foreach (var id in userIds)
            {
                foreach (var c in await _connections.GetConnectionsAsync(id))
                    recipients.Add(c.UserID);
            }
            await SendAsync(recipients, RealtimeHub.Events.FreeChanged);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Realtime FreeChanged fan-out failed for users {UserIds}", userIds);
        }
    }

    public async Task FreeChangedForAsync(IEnumerable<int> recipientUserIds)
    {
        try
        {
            await SendAsync(recipientUserIds.Distinct(), RealtimeHub.Events.FreeChanged);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Realtime FreeChanged failed");
        }
    }

    public async Task FriendsChangedAsync(params int[] userIds)
    {
        try
        {
            await SendAsync(userIds.Distinct(), RealtimeHub.Events.FriendsChanged);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Realtime FriendsChanged failed for users {UserIds}", userIds);
        }
    }

    public async Task FriendRequestReceivedAsync(int toUserId, int fromUserId, string fromName)
    {
        try
        {
            await _hub.Clients.User(toUserId.ToString())
                .SendAsync(RealtimeHub.Events.FriendRequestReceived, new { fromUserId, fromName });
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Realtime FriendRequestReceived failed for user {UserId}", toUserId);
        }
    }

    private Task SendAsync(IEnumerable<int> userIds, string eventName)
    {
        var ids = userIds.Select(id => id.ToString()).ToList();
        return ids.Count == 0 ? Task.CompletedTask : _hub.Clients.Users(ids).SendAsync(eventName);
    }
}
