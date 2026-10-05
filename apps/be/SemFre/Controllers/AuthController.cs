using System.Security.Cryptography;
using System.Text;
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
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly IRefreshTokenService _refreshTokenService;
    private readonly IAccessValidator _access;

    /// <summary>Jak dlouho platí handoff kód - stačí na "Sdílet → Přidat na plochu → otevřít ikonu".</summary>
    private static readonly TimeSpan HandoffLifetime = TimeSpan.FromMinutes(10);

    public AuthController(AppDbContext db, ITokenService tokenService, IRefreshTokenService refreshTokenService, IAccessValidator access)
    {
        _db = db;
        _tokenService = tokenService;
        _refreshTokenService = refreshTokenService;
        _access = access;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(UserRegisterDto dto)
    {
        if (await _db.Users.AnyAsync(u => EF.Functions.Collate(u.Username, "NOCASE") == dto.Username))
            return Conflict(new { message = "Username already taken" });

        var user = new User
        {
            Username = dto.Username,
            PasswordHash = Services.PasswordHasher.Hash(dto.Password),
            Name = dto.Name,
            Phone = dto.Phone,
            Instagram = dto.Instagram
        };
        _db.Users.Add(user);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException) // race: two concurrent registrations of the same handle
        {
            _db.ChangeTracker.Clear();
            return Conflict(new { message = "Username already taken" });
        }

        var userDto = new UserDto { UserID = user.UserID, Username = user.Username, Name = user.Name, CreatedAt = user.CreatedAt };
        return CreatedAtAction(null, userDto);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(UserLoginDto dto)
    {
        var user = await _db.Users.SingleOrDefaultAsync(u => EF.Functions.Collate(u.Username, "NOCASE") == dto.Username);
        if (user == null) return Unauthorized(new { message = "Invalid credentials" });

        if (!Services.PasswordHasher.Verify(user.PasswordHash, dto.Password))
            return Unauthorized(new { message = "Invalid credentials" });

        var token = _tokenService.CreateToken(user.UserID, user.Username);
        var refreshToken = await _refreshTokenService.IssueAsync(user.UserID);
        return Ok(new { token, refreshToken });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshTokenDto dto)
    {
        var userId = await _refreshTokenService.ValidateAsync(dto.RefreshToken);
        if (userId == null) return Unauthorized(new { message = "Invalid or expired refresh token" });

        var user = await _db.Users.SingleOrDefaultAsync(u => u.UserID == userId);
        if (user == null) return Unauthorized(new { message = "Invalid or expired refresh token" });

        var token = _tokenService.CreateToken(user.UserID, user.Username);
        return Ok(new { token });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshTokenDto dto)
    {
        await _refreshTokenService.RevokeAsync(dto.RefreshToken);
        return NoContent();
    }

    private static string HashHandoff(string rawCode) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawCode)));

    /// <summary>
    /// Vydá jednorázový kód pro přenos přihlášení do aplikace na ploše iOS
    /// (viz HandoffCode). Kód se vrací jen jednou; v DB je jen jeho hash.
    /// </summary>
    [Authorize]
    [HttpPost("handoff")]
    public async Task<IActionResult> CreateHandoff()
    {
        var userId = _access.GetCurrentUserId(User);
        if (userId == null) return Unauthorized();

        var rawCode = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        _db.HandoffCodes.Add(new HandoffCode
        {
            UserID = userId.Value,
            CodeHash = HashHandoff(rawCode),
            ExpiresAt = DateTime.UtcNow.Add(HandoffLifetime),
        });
        await _db.SaveChangesAsync();

        return Ok(new { code = rawCode });
    }

    /// <summary>
    /// Vymění handoff kód za nový pár tokenů. Kód jde použít jen jednou -
    /// neplatný, prošlý i už použitý vrací 401 se stejnou zprávou.
    /// </summary>
    [HttpPost("handoff/redeem")]
    public async Task<IActionResult> RedeemHandoff(HandoffRedeemDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code)) return Unauthorized(new { message = "Invalid or expired code" });

        var hash = HashHandoff(dto.Code);
        var now = DateTime.UtcNow;
        // Podmíněný UPDATE místo načíst-zkontrolovat-uložit: dvě souběžná
        // uplatnění téhož kódu tak nemůžou projít obě.
        var claimed = await _db.HandoffCodes
            .Where(c => c.CodeHash == hash && c.UsedAt == null && c.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedAt, now));
        if (claimed == 0) return Unauthorized(new { message = "Invalid or expired code" });

        var userId = await _db.HandoffCodes.Where(c => c.CodeHash == hash).Select(c => c.UserID).SingleAsync();
        var user = await _db.Users.SingleOrDefaultAsync(u => u.UserID == userId);
        if (user == null) return Unauthorized(new { message = "Invalid or expired code" });

        var token = _tokenService.CreateToken(user.UserID, user.Username);
        var refreshToken = await _refreshTokenService.IssueAsync(user.UserID);
        return Ok(new { token, refreshToken });
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
