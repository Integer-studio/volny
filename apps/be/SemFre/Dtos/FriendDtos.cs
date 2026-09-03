using System;

namespace SemFre.Dtos;

/// <summary>A friendship from the caller's perspective — User is always the OTHER party.</summary>
public class FriendDto
{
    public UserSummaryDto User { get; set; } = null!;
    public DateTime EstablishedAt { get; set; }
}

/// <summary>
/// A pending friend request. Used for both /incoming and /outgoing; User is the
/// counterparty (the suggester for /incoming, the suggested user for /outgoing) —
/// the direction is carried by the route, not the payload.
/// </summary>
public class FriendRequestDto
{
    public UserSummaryDto User { get; set; } = null!;
    public DateTime SuggestedAt { get; set; }
}
