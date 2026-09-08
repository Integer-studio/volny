using System.Threading.Tasks;

namespace SemFre.Services;

public interface IRefreshTokenService
{
    /// <summary>Issues a new refresh token for the user and persists its hash. Returns the raw token - never stored, only returned once.</summary>
    Task<string> IssueAsync(int userId);

    /// <summary>Returns the owning user id if the raw token is known, not revoked and not expired; otherwise null.</summary>
    Task<int?> ValidateAsync(string rawToken);

    /// <summary>Revokes the given token if it exists. A no-op (not an error) if it doesn't - logout must never fail because the token is already gone.</summary>
    Task RevokeAsync(string rawToken);

    /// <summary>Revokes every active refresh token for a user, e.g. on password change.</summary>
    Task RevokeAllForUserAsync(int userId);
}
