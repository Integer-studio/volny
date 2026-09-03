using System;
using System.ComponentModel.DataAnnotations;

namespace SemFre.Models;

public class UserDevice
{
    [Key]
    public int DeviceID { get; set; }
    public int UserID { get; set; }
    public string DeviceToken { get; set; } = null!;
    public string? Platform { get; set; }
    public DateTime LastActive { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? User { get; set; }
}
