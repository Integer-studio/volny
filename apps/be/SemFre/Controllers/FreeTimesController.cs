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
    private readonly IRealtimeNotifier _realtime;
    private readonly FreeTimeActivator _activator;

    public FreeTimesController(AppDbContext db, AutoMapper.IMapper mapper, IAccessValidator access, IConnectionService connections, IRealtimeNotifier realtime, FreeTimeActivator activator)
    {
        _realtime = realtime;
        _db = db;
        _mapper = mapper;
        _access = access;
        _connections = connections;
        _activator = activator;
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

        // A slot starting now notifies right away. A planned one (task 0008) only
        // refreshes connections' "Později" list - the push goes out at StartTime
        // from FreeTimeActivationService.
        if (start <= DateTime.UtcNow)
            await _activator.ActivateAsync(ft);
        else
            await _realtime.FreeChangedAsync(userId.Value);

        var res = _mapper.Map<FreeTimeDto>(ft);
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
        await _activator.ActivateAsync(ft);

        var res = _mapper.Map<FreeTimeDto>(ft);

        return CreatedAtAction(nameof(Get), new { id = res.FreeTimeID }, res);
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
        var end = dto.EndTime ?? ft.EndTime;
        if (end < start) return BadRequest(new { message = "EndTime must be after StartTime" });

        var now = DateTime.UtcNow;
        ft.StartTime = start;
        ft.EndTime = end;

        // Dragging the start into the future turns a running slot back into a
        // planned one, so connections get "má teď volno" again at the new start.
        if (start > now) ft.NotifiedAt = null;

        // Pulling a planned start back to now starts it right away instead of
        // waiting up to one FreeTimeActivationService tick.
        if (start <= now && ft.NotifiedAt == null)
        {
            await _activator.ActivateAsync(ft);
            return NoContent();
        }

        await _db.SaveChangesAsync();
        await _realtime.FreeChangedAsync(userId.Value);
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
        await _realtime.FreeChangedAsync(userId.Value);
        return NoContent();
    }
}
