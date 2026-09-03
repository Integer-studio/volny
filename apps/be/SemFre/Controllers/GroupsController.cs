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
public class GroupsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAccessValidator _access;

    public GroupsController(AppDbContext db, IAccessValidator access)
    {
        _db = db;
        _access = access;
    }

    [HttpPost]
    public async Task<IActionResult> Create(GroupCreateDto dto)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var group = new Group { Name = dto.Name, OwnerID = userId.Value };

        for (var attempt = 0; ; attempt++)
        {
            group.InviteCode = InviteCodeGenerator.Generate();
            _db.Groups.Add(group);
            _db.GroupMembers.Add(new GroupMember { Group = group, UserID = userId.Value });
            try
            {
                await _db.SaveChangesAsync();
                break;
            }
            catch (DbUpdateException) when (attempt < 10)
            {
                // 10, not 5: the CVCVCV slug space (~614k) is much smaller
                // than the old 8-char alphabet space, so collisions are more
                // likely as the Groups table grows.
                _db.ChangeTracker.Clear();
                group = new Group { Name = dto.Name, OwnerID = userId.Value };
            }
        }

        var detail = await BuildDetailAsync(group.GroupID, userId.Value);
        return CreatedAtAction(nameof(Get), new { id = group.GroupID }, detail);
    }

    [HttpGet]
    public async Task<IActionResult> MyGroups()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var groups = await (
            from m in _db.GroupMembers.AsNoTracking().Where(m => m.UserID == userId)
            join g in _db.Groups.AsNoTracking() on m.GroupID equals g.GroupID
            select new GroupSummaryDto
            {
                GroupID = g.GroupID,
                Name = g.Name,
                MemberCount = g.Members.Count(),
                IsOwner = g.OwnerID == userId,
                JoinedAt = m.JoinedAt
            }
        ).ToListAsync();

        return Ok(groups);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var isMember = await _db.GroupMembers.AsNoTracking().AnyAsync(m => m.GroupID == id && m.UserID == userId);
        if (!isMember) return NotFound();

        var detail = await BuildDetailAsync(id, userId.Value);
        return Ok(detail);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, GroupUpdateDto dto)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var group = await _db.Groups.SingleOrDefaultAsync(g => g.GroupID == id);
        if (group == null) return NotFound();
        if (group.OwnerID != userId) return Forbid();

        if (dto.Name != null) group.Name = dto.Name;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var group = await _db.Groups.SingleOrDefaultAsync(g => g.GroupID == id);
        if (group == null) return NotFound();
        if (group.OwnerID != userId) return Forbid();

        _db.Groups.Remove(group);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/invite/regenerate")]
    public async Task<IActionResult> RegenerateInvite(int id)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var group = await _db.Groups.SingleOrDefaultAsync(g => g.GroupID == id);
        if (group == null) return NotFound();
        if (group.OwnerID != userId) return Forbid();

        for (var attempt = 0; ; attempt++)
        {
            group.InviteCode = InviteCodeGenerator.Generate();
            try
            {
                await _db.SaveChangesAsync();
                break;
            }
            catch (DbUpdateException) when (attempt < 10)
            {
                _db.ChangeTracker.Clear();
                group = await _db.Groups.SingleAsync(g => g.GroupID == id);
            }
        }

        return Ok(new { inviteCode = group.InviteCode });
    }

    [HttpGet("invite/{code}")]
    [AllowAnonymous]
    [EnableRateLimiting("InvitePreview")]
    public async Task<IActionResult> PreviewInvite(string code)
    {
        var normalized = InviteCodeGenerator.Normalize(code);
        var group = await _db.Groups.AsNoTracking()
            .SingleOrDefaultAsync(g => EF.Functions.Collate(g.InviteCode, "NOCASE") == normalized);
        if (group == null) return NotFound();

        var userId = _access.GetCurrentUserId(User);
        var alreadyMember = userId != null && await _db.GroupMembers.AsNoTracking().AnyAsync(m => m.GroupID == group.GroupID && m.UserID == userId);
        var memberCount = await _db.GroupMembers.AsNoTracking().CountAsync(m => m.GroupID == group.GroupID);
        var owner = await _db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UserID == group.OwnerID);

        return Ok(new GroupInvitePreviewDto
        {
            Name = group.Name,
            MemberCount = memberCount,
            OwnerName = owner?.Name,
            AlreadyMember = alreadyMember
        });
    }

    [HttpPost("join")]
    public async Task<IActionResult> Join(GroupJoinDto dto)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var normalized = InviteCodeGenerator.Normalize(dto.Code);
        var group = await _db.Groups.SingleOrDefaultAsync(g => EF.Functions.Collate(g.InviteCode, "NOCASE") == normalized);
        if (group == null) return NotFound(new { message = "Neplatný nebo zneplatněný kód." });

        var existing = await _db.GroupMembers.AnyAsync(m => m.GroupID == group.GroupID && m.UserID == userId);
        if (!existing)
        {
            _db.GroupMembers.Add(new GroupMember { GroupID = group.GroupID, UserID = userId.Value });
            await _db.SaveChangesAsync();
        }

        var detail = await BuildDetailAsync(group.GroupID, userId.Value);
        detail.AlreadyMember = existing;
        return Ok(detail);
    }

    [HttpDelete("{id:int}/members/me")]
    public async Task<IActionResult> Leave(int id)
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var group = await _db.Groups.AsNoTracking().SingleOrDefaultAsync(g => g.GroupID == id);
        if (group == null) return NotFound();
        if (group.OwnerID == userId) return Conflict(new { message = "Vlastník nemůže skupinu opustit; smaž ji, nebo počkej na předání vlastnictví." });

        var member = await _db.GroupMembers.SingleOrDefaultAsync(m => m.GroupID == id && m.UserID == userId);
        if (member == null) return NotFound();

        _db.GroupMembers.Remove(member);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}/members/{userId:int}")]
    public async Task<IActionResult> RemoveMember(int id, int userId)
    {
        var currentUserId = _access.GetCurrentUserId(User);
        if (currentUserId == null) return Unauthorized();

        var group = await _db.Groups.AsNoTracking().SingleOrDefaultAsync(g => g.GroupID == id);
        if (group == null) return NotFound();
        if (group.OwnerID != currentUserId) return Forbid();
        if (userId == group.OwnerID) return BadRequest(new { message = "Vlastníka nelze odebrat." });

        var member = await _db.GroupMembers.SingleOrDefaultAsync(m => m.GroupID == id && m.UserID == userId);
        if (member == null) return NotFound();

        _db.GroupMembers.Remove(member);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<GroupDetailDto> BuildDetailAsync(int groupId, int currentUserId)
    {
        // "group" is a contextual keyword inside a LINQ query expression
        // (from...select), so the entity variable is named "grp" here to
        // avoid colliding with it in the query below.
        var grp = await _db.Groups.AsNoTracking().SingleAsync(g => g.GroupID == groupId);
        var ownerId = grp.OwnerID;
        var owner = await _db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UserID == ownerId);

        var members = await (
            from m in _db.GroupMembers.AsNoTracking().Where(m => m.GroupID == groupId)
            join u in _db.Users.AsNoTracking() on m.UserID equals u.UserID
            select new GroupMemberDto
            {
                UserID = u.UserID,
                Username = u.Username,
                Name = u.Name,
                JoinedAt = m.JoinedAt,
                IsOwner = u.UserID == ownerId
            }
        ).OrderByDescending(m => m.IsOwner).ThenBy(m => m.Name).ToListAsync();

        return new GroupDetailDto
        {
            GroupID = grp.GroupID,
            Name = grp.Name,
            OwnerID = grp.OwnerID,
            OwnerName = owner?.Name,
            CreatedAt = grp.CreatedAt,
            InviteCode = grp.InviteCode,
            Members = members,
            AlreadyMember = false
        };
    }
}
