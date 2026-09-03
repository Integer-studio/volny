using System;

namespace SemFre.Dtos;

public class UserRegisterDto
{
    public string Username { get; set; } = null!;
    public string Password { get; set; } = null!;
    public string Name { get; set; } = null!;
}

public class UserLoginDto
{
    public string Username { get; set; } = null!;
    public string Password { get; set; } = null!;
}

/// <summary>
/// The authenticated caller's own view of themselves (GET /users/me, and the
/// result of PUT /users/me) - Phone/Instagram are safe here because it's
/// always self. NEVER map an arbitrary other user onto this DTO (see
/// UsersController.Get, which deliberately uses UserSummaryDto instead) or
/// contact info leaks to anyone who knows a user id.
/// </summary>
public class UserDto
{
    public int UserID { get; set; }
    public string Username { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Phone { get; set; }
    public string? Instagram { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>Null unless the user currently has an active free-time window (StartTime &lt;= now &lt; EndTime).</summary>
    public ActiveFreeTimeDto? ActiveFreeTime { get; set; }
}

public class ActiveFreeTimeDto
{
    public DateTime FreeSince { get; set; }
    public DateTime FreeUntil { get; set; }
}

/// <summary>Minimal identity shape embedded wherever a user appears in another DTO.</summary>
public class UserSummaryDto
{
    public int UserID { get; set; }
    public string Username { get; set; } = null!;
    public string Name { get; set; } = null!;
}

public class UserProfileUpdateDto
{
    public string? Username { get; set; }
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Instagram { get; set; }
}

/// <summary>
/// GET /api/users/{id}/profile - the detail popup's payload. Phone/Instagram
/// are only ever populated when the caller is connected (friend or group
/// co-member) to the target - see UsersController.GetProfile.
/// </summary>
public class UserProfileDto
{
    public int UserID { get; set; }
    public string Username { get; set; } = null!;
    public string Name { get; set; } = null!;
    public bool IsFriend { get; set; }
    public bool HasOutgoingRequest { get; set; }
    public bool HasIncomingRequest { get; set; }
    public List<SharedGroupDto> SharedGroups { get; set; } = new();
    public string? Phone { get; set; }
    public string? Instagram { get; set; }
}

public class SharedGroupDto
{
    public int GroupID { get; set; }
    public string Name { get; set; } = null!;
}

public class UserProfileUpdateResultDto
{
    public UserDto User { get; set; } = null!;
    /// <summary>Only set when Username actually changed; a freshly-signed JWT for it.</summary>
    public string? Token { get; set; }
}

public class PasswordChangeDto
{
    public string CurrentPassword { get; set; } = null!;
    public string NewPassword { get; set; } = null!;
}

public class AccountDeleteDto
{
    public string Password { get; set; } = null!;
}
