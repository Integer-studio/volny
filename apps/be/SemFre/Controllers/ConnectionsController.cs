using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SemFre.Data;
using SemFre.Dtos;
using SemFre.Services;

namespace SemFre.Controllers;

/// <summary>
/// "Connections" is deliberately not named "friends": it's friends UNION
/// group co-members, resolved once by IConnectionService so this endpoint
/// and the notification fan-out (FreeTimesController) can never disagree
/// about who is connected to whom.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ConnectionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAccessValidator _access;
    private readonly IConnectionService _connections;

    public ConnectionsController(AppDbContext db, IAccessValidator access, IConnectionService connections)
    {
        _db = db;
        _access = access;
        _connections = connections;
    }

    [HttpGet("free")]
    public async Task<IActionResult> Free()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var connections = await _connections.GetConnectionsAsync(userId.Value);
        if (connections.Count == 0) return Ok(new List<FreeConnectionDto>());

        var connectionIds = connections.Select(c => c.UserID).ToList();
        var now = DateTime.UtcNow;

        var freeRows = await _db.FreeTimes.AsNoTracking()
            .Where(f => connectionIds.Contains(f.UserID) && f.StartTime <= now && f.EndTime > now)
            .GroupBy(f => f.UserID)
            .Select(g => new FreeRow(g.Key, g.Min(x => x.StartTime), g.Max(x => x.EndTime)))
            .ToListAsync();

        var result = ToDtos(freeRows, connections);
        return Ok(result);
    }

    /// <summary>
    /// Planned free time of my connections (task 0008): slots starting within
    /// the next 24 hours, i.e. "bude volný od 18:00". One row per user - the
    /// nearest upcoming slot - with FreeSince = its start. Someone free right
    /// now is in /free instead; the FE drops them from this list too.
    /// </summary>
    [HttpGet("upcoming")]
    public async Task<IActionResult> Upcoming()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var connections = await _connections.GetConnectionsAsync(userId.Value);
        if (connections.Count == 0) return Ok(new List<FreeConnectionDto>());

        var connectionIds = connections.Select(c => c.UserID).ToList();
        var now = DateTime.UtcNow;
        var horizon = now + Validators.FreeTimeCreateDtoValidator.MaxAhead;

        var slots = await _db.FreeTimes.AsNoTracking()
            .Where(f => connectionIds.Contains(f.UserID) && f.StartTime > now && f.StartTime <= horizon)
            .Select(f => new FreeRow(f.UserID, f.StartTime, f.EndTime))
            .ToListAsync();

        var nearest = slots
            .GroupBy(r => r.UserID)
            .Select(g => g.OrderBy(r => r.FreeSince).First())
            .OrderBy(r => r.FreeSince)
            .ToList();

        return Ok(ToDtos(nearest, connections));
    }

    private record FreeRow(int UserID, DateTime FreeSince, DateTime FreeUntil);

    private static List<FreeConnectionDto> ToDtos(IEnumerable<FreeRow> rows, IReadOnlyList<Services.ConnectionInfo> connections)
    {
        var byUser = connections.ToDictionary(c => c.UserID);
        return rows.Select(r =>
        {
            var c = byUser[r.UserID];
            var via = c.IsFriend
                ? new List<ConnectionSourceDto> { new() { Kind = "friend" } }
                : c.SharedGroups.Select(g => new ConnectionSourceDto { Kind = "group", GroupID = g.GroupID, GroupName = g.Name }).ToList();

            return new FreeConnectionDto
            {
                User = new UserSummaryDto { UserID = c.UserID, Username = c.Username, Name = c.Name },
                FreeSince = r.FreeSince,
                FreeUntil = r.FreeUntil,
                Via = via
            };
        }).ToList();
    }
}
