using System;

namespace SemFre.Models;

/// <summary>
/// The owner also gets a row here (see Group.OwnerID) so "is a member" and
/// "is the owner" never need separate code paths - ownership is purely
/// Group.OwnerID == UserID.
/// </summary>
public class GroupMember
{
    public int GroupID { get; set; }
    public int UserID { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public Group? Group { get; set; }
    public User? User { get; set; }
}
