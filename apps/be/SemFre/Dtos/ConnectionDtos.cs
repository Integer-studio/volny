using System;
using System.Collections.Generic;

namespace SemFre.Dtos;

/// <summary>
/// One entry of GET /api/connections/free: someone in the caller's connection
/// graph (friend or, once Groups exists, group co-member) who is free right now.
/// </summary>
public class FreeConnectionDto
{
    public UserSummaryDto User { get; set; } = null!;
    public DateTime FreeSince { get; set; }
    public DateTime FreeUntil { get; set; }
    public List<ConnectionSourceDto> Via { get; set; } = new();
}

/// <summary>Kind is "friend" or "group". GroupID/GroupName are set only for "group".</summary>
public class ConnectionSourceDto
{
    public string Kind { get; set; } = null!;
    public int? GroupID { get; set; }
    public string? GroupName { get; set; }
}
