using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SemFre.Data;
using SemFre.Dtos;
using SemFre.Models;
using SemFre.Services;

namespace SemFre.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FriendSuggestionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAccessValidator _access;
    private readonly NotificationQueue _notifyQueue;

    public FriendSuggestionsController(AppDbContext db, IAccessValidator access, NotificationQueue notifyQueue)
    {
        _db = db;
        _access = access;
        _notifyQueue = notifyQueue;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] int suggestedId)
    {
        var suggesterId = _access.GetCurrentUserId(User);
        if (suggesterId == null) return Unauthorized();
        if (suggesterId == suggestedId) return BadRequest(new { message = "Cannot suggest yourself" });

        if (await _db.FriendSuggestions.AnyAsync(fs => fs.SuggesterID == suggesterId && fs.SuggestedID == suggestedId))
            return Conflict(new { message = "Suggestion already exists" });

        var s = new FriendSuggestion { SuggesterID = suggesterId.Value, SuggestedID = suggestedId };
        _db.FriendSuggestions.Add(s);
        await _db.SaveChangesAsync();

        var users = await _db.Users.AsNoTracking()
            .Where(u => u.UserID == suggesterId || u.UserID == suggestedId)
            .ToDictionaryAsync(u => u.UserID);

        var suggester = users.GetValueOrDefault(suggesterId.Value);
        var suggested = users.GetValueOrDefault(suggestedId);

        var dto = new FriendRequestDto
        {
            User = new UserSummaryDto { UserID = suggested!.UserID, Username = suggested.Username, Name = suggested.Name },
            SuggestedAt = s.SuggestedAt
        };

        await _notifyQueue.EnqueueAsync(new QueuedNotification
        {
            RecipientUserId = s.SuggestedID,
            Message = new NotificationMessage
            {
                Title = "Nová žádost o přátelství",
                Body = $"{suggester?.Name} (@{suggester?.Username}) ti poslal(a) žádost o přátelství.",
                Data = new Dictionary<string, string> { { "type", "friend_request" }, { "suggesterId", s.SuggesterID.ToString() } }
            }
        });

        return CreatedAtAction(null, dto);
    }

    [HttpGet("outgoing")]
    public async Task<IActionResult> Outgoing()
    {
        var suggesterId = _access.GetCurrentUserId(User);
        if (suggesterId == null) return Unauthorized();

        var list = await _db.FriendSuggestions.AsNoTracking()
            .Where(fs => fs.SuggesterID == suggesterId)
            .Select(fs => new FriendRequestDto
            {
                User = new UserSummaryDto { UserID = fs.Suggested!.UserID, Username = fs.Suggested.Username, Name = fs.Suggested.Name },
                SuggestedAt = fs.SuggestedAt
            })
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("incoming")]
    public async Task<IActionResult> Incoming()
    {
        var suggestedId = _access.GetCurrentUserId(User);
        if (suggestedId == null) return Unauthorized();

        var list = await _db.FriendSuggestions.AsNoTracking()
            .Where(fs => fs.SuggestedID == suggestedId)
            .Select(fs => new FriendRequestDto
            {
                User = new UserSummaryDto { UserID = fs.Suggester!.UserID, Username = fs.Suggester.Username, Name = fs.Suggester.Name },
                SuggestedAt = fs.SuggestedAt
            })
            .ToListAsync();
        return Ok(list);
    }

    [HttpDelete]
    public async Task<IActionResult> Delete([FromQuery] int suggesterId, [FromQuery] int suggestedId)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var s = await _db.FriendSuggestions.SingleOrDefaultAsync(fs => fs.SuggesterID == suggesterId && fs.SuggestedID == suggestedId);
        if (s == null) return NotFound();
        if (s.SuggesterID != userId && s.SuggestedID != userId) return Forbid();

        _db.FriendSuggestions.Remove(s);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("accept")]
    public async Task<IActionResult> Accept([FromBody] int suggesterId)
    {
        var suggestedId = _access.GetCurrentUserId(User);
        if (suggestedId == null) return Unauthorized();

        var s = await _db.FriendSuggestions.SingleOrDefaultAsync(fs => fs.SuggesterID == suggesterId && fs.SuggestedID == suggestedId);
        if (s == null) return NotFound();

        var (a, b) = suggesterId < suggestedId ? (suggesterId, suggestedId.Value) : (suggestedId.Value, suggesterId);
        if (await _db.FriendPairs.AnyAsync(fp => fp.Friend1ID == a && fp.Friend2ID == b))
        {
            _db.FriendSuggestions.Remove(s);
            await _db.SaveChangesAsync();
            return Conflict(new { message = "Already friends" });
        }

        var pair = new FriendPair { Friend1ID = a, Friend2ID = b };
        _db.FriendPairs.Add(pair);
        _db.FriendSuggestions.Remove(s);
        await _db.SaveChangesAsync();

        var users = await _db.Users.AsNoTracking()
            .Where(u => u.UserID == a || u.UserID == b)
            .ToDictionaryAsync(u => u.UserID);

        var suggesterUser = users.GetValueOrDefault(suggesterId);
        var accepter = users.GetValueOrDefault(suggestedId.Value);

        var friendDto = new FriendDto
        {
            User = new UserSummaryDto { UserID = suggesterUser!.UserID, Username = suggesterUser.Username, Name = suggesterUser.Name },
            EstablishedAt = pair.EstablishedAt
        };

        await _notifyQueue.EnqueueAsync(new QueuedNotification
        {
            RecipientUserId = s.SuggesterID,
            Message = new NotificationMessage
            {
                Title = "Žádost o přátelství přijata",
                Body = $"{accepter?.Name} (@{accepter?.Username}) přijal(a) tvou žádost o přátelství.",
                Data = new Dictionary<string, string> { { "type", "friend_accepted" }, { "friendId", suggestedId.Value.ToString() } }
            }
        });

        return CreatedAtAction(null, friendDto);
    }

    [HttpPost("reject")]
    public async Task<IActionResult> Reject([FromBody] int suggesterId)
    {
        var suggestedId = _access.GetCurrentUserId(User);
        if (suggestedId == null) return Unauthorized();

        var s = await _db.FriendSuggestions.SingleOrDefaultAsync(fs => fs.SuggesterID == suggesterId && fs.SuggestedID == suggestedId);
        if (s == null) return NotFound();

        _db.FriendSuggestions.Remove(s);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
