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
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AutoMapper.IMapper _mapper;
    private readonly IAccessValidator _access;
    private readonly ITokenService _tokenService;
    private readonly IConnectionService _connections;

    public UsersController(AppDbContext db, AutoMapper.IMapper mapper, IAccessValidator access, ITokenService tokenService, IConnectionService connections)
    {
        _db = db;
        _mapper = mapper;
        _access = access;
        _tokenService = tokenService;
        _connections = connections;
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var user = await _db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UserID == userId);
        if (user == null) return NotFound();
        return Ok(await BuildUserDtoAsync(user));
    }

    /// <summary>
    /// Same "currently free" aggregation as ConnectionsController.Free (StartTime
    /// &lt;= now &lt; EndTime, then Min(StartTime)/Max(EndTime)) so the FE never sees
    /// the client's own status disagree with what friends/group members see.
    /// </summary>
    private async Task<UserDto> BuildUserDtoAsync(Models.User user)
    {
        var dto = _mapper.Map<UserDto>(user);
        var now = DateTime.UtcNow;
        var active = await _db.FreeTimes.AsNoTracking()
            .Where(f => f.UserID == user.UserID && f.StartTime <= now && f.EndTime > now)
            .GroupBy(f => f.UserID)
            .Select(g => new { FreeSince = g.Min(x => x.StartTime), FreeUntil = g.Max(x => x.EndTime) })
            .SingleOrDefaultAsync();
        if (active != null)
        {
            dto.ActiveFreeTime = new ActiveFreeTimeDto { FreeSince = active.FreeSince, FreeUntil = active.FreeUntil };
        }
        return dto;
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string? q = null)
    {
        if (string.IsNullOrWhiteSpace(q)) return BadRequest(new { message = "Query parameter 'q' is required for searching users." });

        var currentUserId = _access.GetCurrentUserId(User);

        var users = await _db.Users.AsNoTracking()
            .Where(u => u.UserID != currentUserId && (EF.Functions.Like(u.Username, $"%{q}%") || EF.Functions.Like(u.Name, $"%{q}%")))
            .ToListAsync();
        return Ok(_mapper.Map<IEnumerable<UserSummaryDto>>(users));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var user = await _db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UserID == id);
        if (user == null) return NotFound();
        // UserSummaryDto, NOT UserDto: UserDto now carries Phone/Instagram,
        // which are only safe to expose about yourself (see its doc comment)
        // - this endpoint returns some arbitrary other user by id with no
        // connection check at all. GetProfile below is the gated one.
        return Ok(_mapper.Map<UserSummaryDto>(user));
    }

    /// <summary>
    /// Backs the profile detail popup. Phone/Instagram are only included when
    /// the caller is connected to the target (friend or group co-member) -
    /// same rule as ConnectionsController.Free, via IConnectionService so the
    /// two can never disagree about who's connected to whom.
    /// </summary>
    [HttpGet("{id:int}/profile")]
    public async Task<IActionResult> GetProfile(int id)
    {
        var currentUserId = _access.GetCurrentUserId(User);
        if (currentUserId == null) return Unauthorized();

        var user = await _db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UserID == id);
        if (user == null) return NotFound();

        var connections = await _connections.GetConnectionsAsync(currentUserId.Value);
        var connection = connections.SingleOrDefault(c => c.UserID == id);
        var isConnected = connection != null;

        var hasOutgoing = await _db.FriendSuggestions.AsNoTracking()
            .AnyAsync(fs => fs.SuggesterID == currentUserId && fs.SuggestedID == id);
        var hasIncoming = await _db.FriendSuggestions.AsNoTracking()
            .AnyAsync(fs => fs.SuggesterID == id && fs.SuggestedID == currentUserId);

        return Ok(new UserProfileDto
        {
            UserID = user.UserID,
            Username = user.Username,
            Name = user.Name,
            IsFriend = connection?.IsFriend ?? false,
            HasOutgoingRequest = hasOutgoing,
            HasIncomingRequest = hasIncoming,
            SharedGroups = connection?.SharedGroups.Select(g => new SharedGroupDto { GroupID = g.GroupID, Name = g.Name }).ToList() ?? [],
            Phone = isConnected ? user.Phone : null,
            Instagram = isConnected ? user.Instagram : null,
        });
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe(UserProfileUpdateDto dto)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var user = await _db.Users.SingleOrDefaultAsync(u => u.UserID == userId);
        if (user == null) return NotFound();

        var usernameChanged = false;
        if (dto.Username != null && !string.Equals(dto.Username, user.Username, StringComparison.OrdinalIgnoreCase))
        {
            var taken = await _db.Users.AnyAsync(u => u.UserID != userId && EF.Functions.Collate(u.Username, "NOCASE") == dto.Username);
            if (taken) return Conflict(new { message = "Uživatelské jméno je již obsazené." });
            user.Username = dto.Username;
            usernameChanged = true;
        }
        else if (dto.Username != null)
        {
            // Same handle modulo case (e.g. re-casing "Petr" -> "petr") - allowed, no conflict check needed.
            user.Username = dto.Username;
            usernameChanged = true;
        }

        if (dto.Name != null) user.Name = dto.Name;
        // Empty string clears the field (distinct from null, which means
        // "leave as-is") - matches how useAutosaveField sends an emptied
        // FormField on the FE.
        if (dto.Phone != null) user.Phone = dto.Phone.Length == 0 ? null : dto.Phone;
        if (dto.Instagram != null) user.Instagram = dto.Instagram.Length == 0 ? null : dto.Instagram;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException) // race: someone else grabbed the same handle concurrently
        {
            _db.ChangeTracker.Clear();
            return Conflict(new { message = "Uživatelské jméno je již obsazené." });
        }

        var result = new UserProfileUpdateResultDto
        {
            User = await BuildUserDtoAsync(user),
            Token = usernameChanged ? _tokenService.CreateToken(user.UserID, user.Username) : null
        };
        return Ok(result);
    }

    [HttpPost("me/password")]
    public async Task<IActionResult> ChangePassword(PasswordChangeDto dto)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var user = await _db.Users.SingleOrDefaultAsync(u => u.UserID == userId);
        if (user == null) return NotFound();

        if (!PasswordHasher.Verify(user.PasswordHash, dto.CurrentPassword))
            return BadRequest(new { message = "Současné heslo není správné." });

        user.PasswordHash = PasswordHasher.Hash(dto.NewPassword);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("me")]
    public async Task<IActionResult> DeleteMe(AccountDeleteDto dto)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var user = await _db.Users.SingleOrDefaultAsync(u => u.UserID == userId);
        if (user == null) return NotFound();

        if (!PasswordHasher.Verify(user.PasswordHash, dto.Password))
            return BadRequest(new { message = "Heslo není správné." });

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
