using System;
using System.ComponentModel.DataAnnotations;

namespace SemFre.Models;

/// <summary>
/// Jednorázový kód, kterým se přihlášení přenese ze Safari do aplikace
/// přidané na plochu iOS. Ta má vlastní úložiště, takže token z Safari
/// nevidí - kód se předá cookie, kterou iOS 17.2+ při "Přidat na plochu"
/// zkopíruje, a aplikace ho vymění za vlastní pár tokenů.
/// </summary>
public class HandoffCode
{
    [Key]
    public int HandoffCodeID { get; set; }
    public int UserID { get; set; }

    /// <summary>SHA-256 hex digest - surový kód se ukládá jen na klientovi, stejně jako u RefreshToken.</summary>
    public string CodeHash { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }

    // Navigation
    public User? User { get; set; }
}
