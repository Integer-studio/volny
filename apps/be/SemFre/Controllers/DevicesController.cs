using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SemFre.Data;
using SemFre.Dtos;
using SemFre.Models;
using System.Security.Claims;

namespace SemFre.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DevicesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AutoMapper.IMapper _mapper;

    public DevicesController(AppDbContext db, AutoMapper.IMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Register(DeviceCreateDto dto)
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrEmpty(sub) || !int.TryParse(sub, out var userId)) return Unauthorized();

        var existing = await _db.UserDevices.FirstOrDefaultAsync(d => d.DeviceToken == dto.DeviceToken);
        var isNew = existing == null;
        if (existing != null)
        {
            if (existing.UserID != userId)
            {
                existing.UserID = userId; // re-assign to this user
            }
            existing.Platform = dto.Platform;
            existing.LastActive = DateTime.UtcNow;
        }
        else
        {
            existing = new UserDevice { UserID = userId, DeviceToken = dto.DeviceToken, Platform = dto.Platform, LastActive = DateTime.UtcNow };
            _db.UserDevices.Add(existing);
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException) // unique index violation from a concurrent register of the same token
        {
            _db.ChangeTracker.Clear();
            existing = await _db.UserDevices.FirstAsync(d => d.DeviceToken == dto.DeviceToken);
            existing.UserID = userId;
            existing.Platform = dto.Platform;
            existing.LastActive = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            isNew = false;
        }

        return isNew
            ? CreatedAtAction(nameof(Get), new { id = existing.DeviceID }, _mapper.Map<DeviceDto>(existing))
            : Ok(_mapper.Map<DeviceDto>(existing));
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> List()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrEmpty(sub) || !int.TryParse(sub, out var userId)) return Unauthorized();

        var devices = await _db.UserDevices.AsNoTracking().Where(d => d.UserID == userId).ToListAsync();
        return Ok(_mapper.Map<IEnumerable<DeviceDto>>(devices));
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> Get(int id)
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrEmpty(sub) || !int.TryParse(sub, out var userId)) return Unauthorized();

        var d = await _db.UserDevices.AsNoTracking().SingleOrDefaultAsync(x => x.DeviceID == id && x.UserID == userId);
        if (d == null) return NotFound();
        return Ok(_mapper.Map<DeviceDto>(d));
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrEmpty(sub) || !int.TryParse(sub, out var userId)) return Unauthorized();

        var d = await _db.UserDevices.SingleOrDefaultAsync(x => x.DeviceID == id && x.UserID == userId);
        if (d == null) return NotFound();
        _db.UserDevices.Remove(d);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
