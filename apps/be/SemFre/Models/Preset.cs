using System.ComponentModel.DataAnnotations;

namespace SemFre.Models;

/// <summary>
/// A user's daily anchor for "free until ..." (task 0009). Stored as a wall-clock
/// time of day with no timezone - "do oběda" means 12:00 wherever the user is,
/// and the FE resolves it to the next occurrence in local time.
/// </summary>
public class Preset
{
    [Key]
    public int PresetID { get; set; }

    public int UserID { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Key of an icon from the FE's curated set, see <see cref="Services.DefaultPresets.IconKeys"/>.</summary>
    public string Icon { get; set; } = string.Empty;

    /// <summary>Minute of the day (0-1439), always a multiple of 15.</summary>
    public int Minute { get; set; }

    // Navigation
    public User? User { get; set; }
}
