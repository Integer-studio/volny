namespace SemFre.Services;

public sealed record SharedGroupRef(int GroupID, string Name);

public sealed record ConnectionInfo(int UserID, string Username, string Name, bool IsFriend, IReadOnlyList<SharedGroupRef> SharedGroups);

/// <summary>
/// Single source of truth for "who is connected to me" - friends today,
/// friends UNION group co-members once Groups exists. Both the read
/// endpoints and the notification fan-out are built on the exact same two
/// query shapes, so they can never disagree about who can see whom.
/// </summary>
public interface IConnectionService
{
    Task<IReadOnlyList<ConnectionInfo>> GetConnectionsAsync(int userId);
    Task<bool> AreConnectedAsync(int userA, int userB);
}
