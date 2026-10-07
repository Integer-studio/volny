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

    /// <summary>
    /// Per-group opt-out (task 0021): when false, this member's free status
    /// and contact info are not shared through this group, and - since the
    /// rule is mutual - they don't see the other members' either. Friendship
    /// is unaffected. See ConnectionService.
    /// </summary>
    public bool SharesWithGroup { get; set; } = true;

    public Group? Group { get; set; }
    public User? User { get; set; }
}
