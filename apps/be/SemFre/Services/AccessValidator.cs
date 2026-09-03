using System.Security.Claims;

namespace SemFre.Services;

public class AccessValidator : IAccessValidator
{
    public int? GetCurrentUserId(ClaimsPrincipal user)
    {
        var sub = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrEmpty(sub) || !int.TryParse(sub, out var id)) return null;
        return id;
    }
}
