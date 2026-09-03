using System;

namespace SemFre.Models;

public class FriendSuggestion
{
    public int SuggesterID { get; set; }
    public int SuggestedID { get; set; }
    public DateTime SuggestedAt { get; set; } = DateTime.UtcNow;

    public User? Suggester { get; set; }
    public User? Suggested { get; set; }
}
