using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SemFre.Data;
using SemFre.Dtos;
using SemFre.Models;
using SemFre.Services;

namespace SemFre.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FriendsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAccessValidator _access;
    private readonly NotificationQueue _notifyQueue;

    public FriendsController(AppDbContext db, IAccessValidator access, NotificationQueue notifyQueue)
    {
        _db = db;
        _access = access;
        _notifyQueue = notifyQueue;
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

    [HttpGet("invite/code")]
    public async Task<IActionResult> GetMyInviteCode()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var user = await _db.Users.SingleAsync(u => u.UserID == userId);
        if (!IsCodeValid(user))
        {
            for (var attempt = 0; ; attempt++)
            {
                user.FriendInviteCode = InviteCodeGenerator.Generate();
                user.FriendInviteCodeGeneratedAt = DateTime.UtcNow;
                try
                {
                    await _db.SaveChangesAsync();
                    break;
                }
                catch (DbUpdateException) when (attempt < 10)
                {
                    _db.ChangeTracker.Clear();
                    user = await _db.Users.SingleAsync(u => u.UserID == userId);
                }
            }
        }

        return Ok(new { code = user.FriendInviteCode });
    }

    [HttpPost("invite/regenerate")]
    public async Task<IActionResult> RegenerateMyInviteCode()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var user = await _db.Users.SingleAsync(u => u.UserID == userId);
        for (var attempt = 0; ; attempt++)
        {
            user.FriendInviteCode = InviteCodeGenerator.Generate();
            user.FriendInviteCodeGeneratedAt = DateTime.UtcNow;
            try
            {
                await _db.SaveChangesAsync();
                break;
            }
            catch (DbUpdateException) when (attempt < 10)
            {
                _db.ChangeTracker.Clear();
                user = await _db.Users.SingleAsync(u => u.UserID == userId);
            }
        }

        return Ok(new { code = user.FriendInviteCode });
    }

    [HttpGet("invite/{code}")]
    [AllowAnonymous]
    [EnableRateLimiting("InvitePreview")]
    public async Task<IActionResult> PreviewFriendInvite(string code)
    {
        var normalized = InviteCodeGenerator.Normalize(code);
        var cutoff = DateTime.UtcNow.AddHours(-24);
        var target = await _db.Users.AsNoTracking().SingleOrDefaultAsync(u =>
            EF.Functions.Collate(u.FriendInviteCode, "NOCASE") == normalized &&
            u.FriendInviteCodeGeneratedAt != null && u.FriendInviteCodeGeneratedAt > cutoff);
        if (target == null) return NotFound();

        var userId = _access.GetCurrentUserId(User);
        var alreadyFriend = false;
        if (userId != null)
        {
            var (a, b) = userId.Value < target.UserID ? (userId.Value, target.UserID) : (target.UserID, userId.Value);
            alreadyFriend = await _db.FriendPairs.AsNoTracking().AnyAsync(fp => fp.Friend1ID == a && fp.Friend2ID == b);
        }

        return Ok(new FriendInvitePreviewDto
        {
            Name = target.Name,
            Username = target.Username,
            AlreadyFriend = alreadyFriend
        });
    }

    [HttpPost("invite/{code}/accept")]
    public async Task<IActionResult> AcceptFriendInvite(string code)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var normalized = InviteCodeGenerator.Normalize(code);
        var cutoff = DateTime.UtcNow.AddHours(-24);
        var target = await _db.Users.SingleOrDefaultAsync(u =>
            EF.Functions.Collate(u.FriendInviteCode, "NOCASE") == normalized &&
            u.FriendInviteCodeGeneratedAt != null && u.FriendInviteCodeGeneratedAt > cutoff);
        if (target == null) return NotFound(new { message = "Neplatný nebo zneplatněný kód." });
        if (target.UserID == userId) return BadRequest(new { message = "Nemůžeš přidat sám sebe." });

        var (a, b) = userId.Value < target.UserID ? (userId.Value, target.UserID) : (target.UserID, userId.Value);
        var pair = await _db.FriendPairs.SingleOrDefaultAsync(fp => fp.Friend1ID == a && fp.Friend2ID == b);
        if (pair == null)
        {
            pair = new FriendPair { Friend1ID = a, Friend2ID = b };
            _db.FriendPairs.Add(pair);

            var pendingSuggestions = await _db.FriendSuggestions
                .Where(fs => (fs.SuggesterID == userId && fs.SuggestedID == target.UserID) ||
                             (fs.SuggesterID == target.UserID && fs.SuggestedID == userId))
                .ToListAsync();
            _db.FriendSuggestions.RemoveRange(pendingSuggestions);

            await _db.SaveChangesAsync();

            var me = await _db.Users.AsNoTracking().SingleAsync(u => u.UserID == userId);
            await _notifyQueue.EnqueueAsync(new QueuedNotification
            {
                RecipientUserId = target.UserID,
                Message = new NotificationMessage
                {
                    Title = "Nový kamarád",
                    Body = $"{me.Name} (@{me.Username}) se s tebou spřátelil naskenováním QR kódu.",
                    Data = new Dictionary<string, string> { { "type", "friend_added_via_qr" }, { "friendId", me.UserID.ToString() } }
                }
            });
        }

        return Ok(new FriendDto
        {
            User = new UserSummaryDto { UserID = target.UserID, Username = target.Username, Name = target.Name },
            EstablishedAt = pair.EstablishedAt
        });
    }

    private static bool IsCodeValid(User user) =>
        user.FriendInviteCode != null && user.FriendInviteCodeGeneratedAt != null &&
        DateTime.UtcNow - user.FriendInviteCodeGeneratedAt.Value <= TimeSpan.FromHours(24);
}
