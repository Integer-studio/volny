using Microsoft.EntityFrameworkCore;
using SemFre.Data;

namespace SemFre.Services;

public class ConnectionService : IConnectionService
{
    private readonly AppDbContext _db;

    public ConnectionService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<ConnectionInfo>> GetConnectionsAsync(int userId)
    {
        var friendRows = await _db.FriendPairs.AsNoTracking()
            .Where(fp => fp.Friend1ID == userId || fp.Friend2ID == userId)
            .Select(fp => fp.Friend1ID == userId ? fp.Friend2ID : fp.Friend1ID)
            .Join(_db.Users.AsNoTracking(), id => id, u => u.UserID, (id, u) => new { u.UserID, u.Username, u.Name })
            .ToListAsync();

        var groupRows = await (
            from mine in _db.GroupMembers.AsNoTracking().Where(m => m.UserID == userId)
            join peer in _db.GroupMembers.AsNoTracking() on mine.GroupID equals peer.GroupID
            join g in _db.Groups.AsNoTracking() on mine.GroupID equals g.GroupID
            join u in _db.Users.AsNoTracking() on peer.UserID equals u.UserID
            where peer.UserID != userId
            select new { u.UserID, u.Username, u.Name, g.GroupID, GroupName = g.Name }
        ).ToListAsync();

        // Structural dedupe: someone who is both a friend and a co-member of
        // two groups ends up as exactly one ConnectionInfo with IsFriend=true
        // and two SharedGroups entries, not three separate rows.
        var map = new Dictionary<int, (string Username, string Name, bool IsFriend, List<SharedGroupRef> Groups)>();

        foreach (var f in friendRows)
            map[f.UserID] = (f.Username, f.Name, true, new List<SharedGroupRef>());

        foreach (var g in groupRows)
        {
            if (map.TryGetValue(g.UserID, out var existing))
                existing.Groups.Add(new SharedGroupRef(g.GroupID, g.GroupName));
            else
                map[g.UserID] = (g.Username, g.Name, false, new List<SharedGroupRef> { new(g.GroupID, g.GroupName) });
        }

        return map.Select(kv => new ConnectionInfo(kv.Key, kv.Value.Username, kv.Value.Name, kv.Value.IsFriend, kv.Value.Groups)).ToList();
    }

    public async Task<bool> AreConnectedAsync(int userA, int userB)
    {
        if (userA == userB) return true;

        var (a, b) = userA < userB ? (userA, userB) : (userB, userA);
        if (await _db.FriendPairs.AsNoTracking().AnyAsync(fp => fp.Friend1ID == a && fp.Friend2ID == b))
            return true;

        var myGroupIds = _db.GroupMembers.AsNoTracking().Where(m => m.UserID == userA).Select(m => m.GroupID);
        return await _db.GroupMembers.AsNoTracking().AnyAsync(m => m.UserID == userB && myGroupIds.Contains(m.GroupID));
    }
}
