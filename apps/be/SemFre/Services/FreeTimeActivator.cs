using Microsoft.EntityFrameworkCore;
using SemFre.Data;
using SemFre.Models;

namespace SemFre.Services;

/// <summary>
/// Turns a free-time slot "live" for the user's connections: the "má teď volno"
/// push plus the realtime refetch signal, and stamps NotifiedAt so it happens
/// once per start. Shared by FreeTimesController (slot starting now) and
/// FreeTimeActivationService (planned slot whose StartTime has just passed, task
/// 0008) - so a planned start notifies exactly like pressing the button.
/// </summary>
public class FreeTimeActivator
{
    private readonly AppDbContext _db;
    private readonly IConnectionService _connections;
    private readonly NotificationQueue _notifyQueue;
    private readonly IRealtimeNotifier _realtime;

    public FreeTimeActivator(AppDbContext db, IConnectionService connections, NotificationQueue notifyQueue, IRealtimeNotifier realtime)
    {
        _db = db;
        _connections = connections;
        _notifyQueue = notifyQueue;
        _realtime = realtime;
    }

    /// <summary>The slot must be tracked by this scope's AppDbContext - NotifiedAt is saved here.</summary>
    public async Task ActivateAsync(FreeTime ft)
    {
        ft.NotifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await NotifyConnectionsImFreeAsync(ft.UserID, ft.FreeTimeID);
        await _realtime.FreeChangedAsync(ft.UserID);
    }

    private async Task NotifyConnectionsImFreeAsync(int userId, int freeTimeId)
    {
        var me = await _db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UserID == userId);
        var connections = await _connections.GetConnectionsAsync(userId);
        if (connections.Count == 0) return;

        // Only tell connections who are ALSO free right now - same "who is free"
        // query as ConnectionsController.Free (GET /api/connections/free), otherwise
        // every friend gets pinged regardless of whether hanging out is even possible.
        var connectionIds = connections.Select(c => c.UserID).ToList();
        var now = DateTime.UtcNow;
        var freeUserIds = (await _db.FreeTimes.AsNoTracking()
            .Where(f => connectionIds.Contains(f.UserID) && f.StartTime <= now && f.EndTime > now)
            .Select(f => f.UserID)
            .Distinct()
            .ToListAsync())
            .ToHashSet();

        foreach (var c in connections.Where(c => freeUserIds.Contains(c.UserID)))
        {
            var data = new Dictionary<string, string> { { "type", "friend_imfree" }, { "freeTimeId", freeTimeId.ToString() } };
            string title;
            if (c.IsFriend || c.SharedGroups.Count == 0)
            {
                title = "Kamarád má teď volno";
            }
            else
            {
                title = c.SharedGroups[0].Name;
                data["sharedGroupId"] = c.SharedGroups[0].GroupID.ToString();
                data["sharedGroupName"] = c.SharedGroups[0].Name;
            }

            await _notifyQueue.EnqueueAsync(new QueuedNotification
            {
                RecipientUserId = c.UserID,
                Message = new NotificationMessage
                {
                    Title = title,
                    Body = $"{me?.Name} (@{me?.Username}) má teď volno.",
                    Data = data
                }
            });
        }
    }
}
