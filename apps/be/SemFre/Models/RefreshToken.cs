using System;
using System.ComponentModel.DataAnnotations;

namespace SemFre.Models;

public class RefreshToken
{
    [Key]
    public int RefreshTokenID { get; set; }
    public int UserID { get; set; }

    /// <summary>SHA-256 hex digest of the raw refresh token - the raw value is
    /// never persisted, only handed to the client once at issuance.</summary>
    public string TokenHash { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    // Navigation
    public User? User { get; set; }
}
