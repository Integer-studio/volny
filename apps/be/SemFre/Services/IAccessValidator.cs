using System.Security.Claims;

namespace SemFre.Services;

public interface IAccessValidator
{
    int? GetCurrentUserId(ClaimsPrincipal user);
}
