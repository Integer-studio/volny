using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SemFre.Data;
using SemFre.Dtos;
using SemFre.Services;

namespace SemFre.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FriendsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAccessValidator _access;

    public FriendsController(AppDbContext db, IAccessValidator access)
    {
        _db = db;
        _access = access;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        // A ternary picking between two navigation properties (Friend1 vs Friend2)
        // does not translate on the SQLite provider. Project the other side's id
        // first, then join Users on it - that translates to a single query.
        var friends = await _db.FriendPairs.AsNoTracking()
            .Where(fp => fp.Friend1ID == userId || fp.Friend2ID == userId)
            .Select(fp => new
            {
                OtherId = fp.Friend1ID == userId ? fp.Friend2ID : fp.Friend1ID,
                fp.EstablishedAt
            })
            .Join(_db.Users.AsNoTracking(), x => x.OtherId, u => u.UserID, (x, u) => new FriendDto
            {
                User = new UserSummaryDto { UserID = u.UserID, Username = u.Username, Name = u.Name },
                EstablishedAt = x.EstablishedAt
            })
            .OrderBy(f => f.User.Name)
            .ToListAsync();

        return Ok(friends);
    }

    [HttpDelete("{otherUserId:int}")]
    public async Task<IActionResult> Remove(int otherUserId)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var (a, b) = userId.Value < otherUserId ? (userId.Value, otherUserId) : (otherUserId, userId.Value);
        var pair = await _db.FriendPairs.SingleOrDefaultAsync(fp => fp.Friend1ID == a && fp.Friend2ID == b);
        if (pair == null) return NotFound();

        _db.FriendPairs.Remove(pair);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
