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
public class FreeTimesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AutoMapper.IMapper _mapper;
    private readonly IAccessValidator _access;
    private readonly IConnectionService _connections;
    private readonly NotificationQueue _notifyQueue;

    public FreeTimesController(AppDbContext db, AutoMapper.IMapper mapper, IAccessValidator access, IConnectionService connections, NotificationQueue notifyQueue)
    {
        _db = db;
        _mapper = mapper;
        _access = access;
        _connections = connections;
        _notifyQueue = notifyQueue;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? userId = null)
    {
        var currentUserId = _access.GetCurrentUserId(User);
        if (currentUserId == null) return Unauthorized();

        var targetUser = userId ?? currentUserId.Value;

        if (targetUser != currentUserId)
        {
            var ok = await _connections.AreConnectedAsync(currentUserId.Value, targetUser);
            if (!ok) return Forbid();
        }

        var list = await _db.FreeTimes.AsNoTracking().Where(f => f.UserID == targetUser).ToListAsync();
        return Ok(_mapper.Map<IEnumerable<FreeTimeDto>>(list));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var currentUserId = _access.GetCurrentUserId(User);
        if (currentUserId == null) return Unauthorized();

        var f = await _db.FreeTimes.AsNoTracking().SingleOrDefaultAsync(x => x.FreeTimeID == id);
        if (f == null) return NotFound();

        if (f.UserID != currentUserId)
        {
            var ok = await _connections.AreConnectedAsync(currentUserId.Value, f.UserID);
            if (!ok) return Forbid();
        }

        return Ok(_mapper.Map<FreeTimeDto>(f));
    }

    [HttpPost]
    public async Task<IActionResult> Create(FreeTimeCreateDto dto)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var start = dto.StartTime ?? DateTime.UtcNow;
        var end = dto.EndTime ?? start.Date.AddDays(1).AddSeconds(-1);
        if (end < start) return BadRequest(new { message = "EndTime must be after StartTime" });

        var ft = new FreeTime { UserID = userId.Value, StartTime = start, EndTime = end };
        _db.FreeTimes.Add(ft);
        await _db.SaveChangesAsync();

        var res = _mapper.Map<FreeTimeDto>(ft);

        // Only notify friends if the user is free right now, not for a future slot.
        if (start <= DateTime.UtcNow)
        {
            await NotifyConnectionsImFreeAsync(userId.Value, res.FreeTimeID);
        }

        return CreatedAtAction(nameof(Get), new { id = res.FreeTimeID }, res);
    }

    [HttpPost("imfree")]
    public async Task<IActionResult> ImFree()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var start = DateTime.UtcNow;
        var end = start.Date.AddDays(1).AddSeconds(-1);

        var ft = new FreeTime { UserID = userId.Value, StartTime = start, EndTime = end };
        _db.FreeTimes.Add(ft);
        await _db.SaveChangesAsync();

        var res = _mapper.Map<FreeTimeDto>(ft);

        await NotifyConnectionsImFreeAsync(userId.Value, res.FreeTimeID);

        return CreatedAtAction(nameof(Get), new { id = res.FreeTimeID }, res);
    }

    private async Task NotifyConnectionsImFreeAsync(int userId, int freeTimeId)
    {
        var me = await _db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UserID == userId);
        var connections = await _connections.GetConnectionsAsync(userId);

        foreach (var c in connections)
        {
            var data = new Dictionary<string, string> { { "type", "friend_imfree" }, { "freeTimeId", freeTimeId.ToString() } };
            string title;
            if (c.IsFriend || c.SharedGroups.Count == 0)
            {
                title = "Kamarád má teď volno";
            }
            else
            {
                title = c.SharedGroups[0].Name;
                data["sharedGroupId"] = c.SharedGroups[0].GroupID.ToString();
                data["sharedGroupName"] = c.SharedGroups[0].Name;
            }

            await _notifyQueue.EnqueueAsync(new QueuedNotification
            {
                RecipientUserId = c.UserID,
                Message = new NotificationMessage
                {
                    Title = title,
                    Body = $"{me?.Name} (@{me?.Username}) má teď volno.",
                    Data = data
                }
            });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, FreeTimeCreateDto dto)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var ft = await _db.FreeTimes.SingleOrDefaultAsync(f => f.FreeTimeID == id);
        if (ft == null) return NotFound();
        if (ft.UserID != userId) return Forbid();

        var start = dto.StartTime ?? ft.StartTime;
        var end = dto.EndTime ?? start.Date.AddDays(1).AddSeconds(-1);
        if (end < start) return BadRequest(new { message = "EndTime must be after StartTime" });

        ft.StartTime = start;
        ft.EndTime = end;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var ft = await _db.FreeTimes.SingleOrDefaultAsync(f => f.FreeTimeID == id);
        if (ft == null) return NotFound();
        if (ft.UserID != userId) return Forbid();

        _db.FreeTimes.Remove(ft);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
