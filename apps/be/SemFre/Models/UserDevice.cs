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

    /// <summary>Push provider the token belongs to: "expo" (Android/iOS via Expo Push
    /// Service) or "fcm_web" (browser, sent directly through FCM HTTP v1). Derived from
    /// the token's own format at registration time - see DevicesController.Register.</summary>
    public string TokenType { get; set; } = "expo";

    public DateTime LastActive { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? User { get; set; }
}
