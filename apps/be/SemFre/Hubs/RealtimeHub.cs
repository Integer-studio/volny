using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace SemFre.Hubs;

/// <summary>
/// Server -> client only. Clients never invoke anything here; they just listen
/// for refetch signals sent by <see cref="SemFre.Services.RealtimeNotifier"/>.
/// Each user is addressed via Clients.User(id), which covers all their devices.
/// </summary>
[Authorize]
public class RealtimeHub : Hub
{
    public const string Path = "/hubs/realtime";

    public static class Events
    {
        public const string FreeChanged = "FreeChanged";
        public const string FriendsChanged = "FriendsChanged";
        public const string FriendRequestReceived = "FriendRequestReceived";
    }
}
