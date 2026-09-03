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

    public AuthController(AppDbContext db, ITokenService tokenService)
    {
        _db = db;
        _tokenService = tokenService;
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
            Name = dto.Name
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
        return Ok(new { token });
    }
}
