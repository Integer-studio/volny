using SemFre.Models;

namespace SemFre.Services;

/// <summary>
/// The presets every user starts with, and the icon keys the FE knows how to
/// draw. Used by registration, by POST /api/presets/reset and (as a frozen copy)
/// by the AddPresets migration that seeded existing users.
/// </summary>
public static class DefaultPresets
{
    /// <summary>Must match <c>PRESET_ICONS</c> in apps/fe/components/TimeRing/presets.ts.</summary>
    public static readonly IReadOnlySet<string> IconKeys = new HashSet<string>
    {
        "sunrise", "sun", "sunset", "moon-star", "house", "coffee", "utensils",
        "briefcase", "graduation-cap", "dumbbell", "beer", "bed", "car",
        "train-front", "baby", "dog", "gamepad-2", "music", "book-open",
        "shopping-cart",
    };

    private static readonly (string Name, string Icon, int Minute)[] Defaults =
    {
        ("Ráno", "sunrise", 8 * 60),
        ("Poledne", "sun", 12 * 60),
        ("Odpoledne", "house", 16 * 60),
        ("Večer", "sunset", 21 * 60),
        ("Půlnoc", "moon-star", 0),
    };

    public static IEnumerable<Preset> For(int userId) =>
        Defaults.Select(d => new Preset { UserID = userId, Name = d.Name, Icon = d.Icon, Minute = d.Minute });

    /// <summary>For seeding a user who isn't saved yet - EF fills in UserID via the navigation.</summary>
    public static IEnumerable<Preset> For(User user) =>
        Defaults.Select(d => new Preset { User = user, Name = d.Name, Icon = d.Icon, Minute = d.Minute });
}
