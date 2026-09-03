using System;
using System.Collections.Generic;

namespace SemFre.Dtos;

public class GroupCreateDto
{
    public string Name { get; set; } = null!;
}

public class GroupUpdateDto
{
    public string? Name { get; set; }
}

public class GroupJoinDto
{
    public string Code { get; set; } = null!;
}

public class GroupSummaryDto
{
    public int GroupID { get; set; }
    public string Name { get; set; } = null!;
    public int MemberCount { get; set; }
    public bool IsOwner { get; set; }
    public DateTime JoinedAt { get; set; }
}

public class GroupMemberDto
{
    public int UserID { get; set; }
    public string Username { get; set; } = null!;
    public string Name { get; set; } = null!;
    public DateTime JoinedAt { get; set; }
    public bool IsOwner { get; set; }
}

public class GroupDetailDto
{
    public int GroupID { get; set; }
    public string Name { get; set; } = null!;
    public int OwnerID { get; set; }
    public string? OwnerName { get; set; }
    public DateTime CreatedAt { get; set; }
    public string InviteCode { get; set; } = null!;
    public List<GroupMemberDto> Members { get; set; } = new();
    public bool AlreadyMember { get; set; }
}

public class GroupInvitePreviewDto
{
    public string Name { get; set; } = null!;
    public int MemberCount { get; set; }
    public string? OwnerName { get; set; }
    public bool AlreadyMember { get; set; }
}
