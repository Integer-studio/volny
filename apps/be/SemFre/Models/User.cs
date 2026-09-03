using System;

namespace SemFre.Models;

public class User
{
    public int UserID { get; set; }
    public string Username { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string Name { get; set; } = null!;
    /// <summary>Optional contact info, only ever exposed to friends/co-members - see UsersController.GetProfile.</summary>
    public string? Phone { get; set; }
    public string? Instagram { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
