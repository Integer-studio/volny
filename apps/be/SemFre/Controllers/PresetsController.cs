using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SemFre.Data;
using SemFre.Dtos;
using SemFre.Models;
using SemFre.Services;

namespace SemFre.Controllers;

/// <summary>
/// The caller's own presets (task 0009). Presets are private - nobody else's
/// are ever readable, so there is no userId parameter anywhere.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PresetsController : ControllerBase
{
    private const string DuplicateMinuteMessage = "V tenhle čas už máš jiný preset.";

    private readonly AppDbContext _db;
    private readonly IAccessValidator _access;

    public PresetsController(AppDbContext db, IAccessValidator access)
    {
        _db = db;
        _access = access;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        return Ok(await ListFor(userId.Value));
    }

    [HttpPost]
    public async Task<IActionResult> Create(PresetUpsertDto dto)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        if (await _db.Presets.AnyAsync(p => p.UserID == userId && p.Minute == dto.Minute))
            return Conflict(new { message = DuplicateMinuteMessage });

        var preset = new Preset { UserID = userId.Value, Name = dto.Name.Trim(), Icon = dto.Icon, Minute = dto.Minute };
        _db.Presets.Add(preset);
        if (!await TrySave()) return Conflict(new { message = DuplicateMinuteMessage });

        return CreatedAtAction(nameof(List), ToDto(preset));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, PresetUpsertDto dto)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        // Someone else's preset is reported as missing, not forbidden - its
        // existence is none of the caller's business.
        var preset = await _db.Presets.SingleOrDefaultAsync(p => p.PresetID == id && p.UserID == userId);
        if (preset == null) return NotFound();

        if (await _db.Presets.AnyAsync(p => p.UserID == userId && p.Minute == dto.Minute && p.PresetID != id))
            return Conflict(new { message = DuplicateMinuteMessage });

        preset.Name = dto.Name.Trim();
        preset.Icon = dto.Icon;
        preset.Minute = dto.Minute;
        if (!await TrySave()) return Conflict(new { message = DuplicateMinuteMessage });

        return Ok(ToDto(preset));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var preset = await _db.Presets.SingleOrDefaultAsync(p => p.PresetID == id && p.UserID == userId);
        if (preset == null) return NotFound();

        _db.Presets.Remove(preset);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Replaces all of the caller's presets with the defaults.</summary>
    [HttpPost("reset")]
    public async Task<IActionResult> Reset()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        await using var tx = await _db.Database.BeginTransactionAsync();
        await _db.Presets.Where(p => p.UserID == userId).ExecuteDeleteAsync();
        _db.Presets.AddRange(DefaultPresets.For(userId.Value));
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(await ListFor(userId.Value));
    }

    private async Task<List<PresetDto>> ListFor(int userId) =>
        await _db.Presets.AsNoTracking()
            .Where(p => p.UserID == userId)
            .OrderBy(p => p.Minute)
            .Select(p => new PresetDto { PresetID = p.PresetID, Name = p.Name, Icon = p.Icon, Minute = p.Minute })
            .ToListAsync();

    private static PresetDto ToDto(Preset p) =>
        new() { PresetID = p.PresetID, Name = p.Name, Icon = p.Icon, Minute = p.Minute };

    /// <summary>
    /// The pre-check above covers the normal case; this catches the race of two
    /// concurrent writes to the same minute, which the unique index rejects.
    /// </summary>
    private async Task<bool> TrySave()
    {
        try
        {
            await _db.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateException)
        {
            _db.ChangeTracker.Clear();
            return false;
        }
    }
}
