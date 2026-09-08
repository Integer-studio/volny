using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SemFre.Data;
using SemFre.Models;

namespace SemFre.Services;

public class RefreshTokenService : IRefreshTokenService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public RefreshTokenService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    private int ExpiresDays => int.TryParse(_config["Auth:RefreshTokenExpiresDays"], out var d) ? d : 90;

    private static string Hash(string rawToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

    public async Task<string> IssueAsync(int userId)
    {
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserID = userId,
            TokenHash = Hash(rawToken),
            ExpiresAt = DateTime.UtcNow.AddDays(ExpiresDays),
        });
        await _db.SaveChangesAsync();

        return rawToken;
    }

    public async Task<int?> ValidateAsync(string rawToken)
    {
        var hash = Hash(rawToken);
        var entry = await _db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == hash);
        if (entry == null || entry.RevokedAt != null || entry.ExpiresAt <= DateTime.UtcNow)
            return null;

        return entry.UserID;
    }

    public async Task RevokeAsync(string rawToken)
    {
        var hash = Hash(rawToken);
        var entry = await _db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == hash);
        if (entry == null || entry.RevokedAt != null) return;

        entry.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task RevokeAllForUserAsync(int userId)
    {
        await _db.RefreshTokens
            .Where(t => t.UserID == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));
    }
}
