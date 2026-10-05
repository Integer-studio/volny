using Microsoft.AspNetCore.SignalR;

namespace SemFre.Services;

/// <summary>
/// Maps a hub connection to the same user id controllers use, so
/// Clients.User(id.ToString()) reaches every connection of that user.
/// </summary>
public class UserIdProvider : IUserIdProvider
{
    private readonly AccessValidator _access = new();

    public string? GetUserId(HubConnectionContext connection)
        => _access.GetCurrentUserId(connection.User)?.ToString();
}
