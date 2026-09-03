using System;
using System.Collections.Generic;

namespace SemFre.Models;

public class Group
{
    public int GroupID { get; set; }
    public string Name { get; set; } = null!;
    public int OwnerID { get; set; }
    public string InviteCode { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? Owner { get; set; }
    public ICollection<GroupMember> Members { get; set; } = new List<GroupMember>();
}
