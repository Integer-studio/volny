using System;

namespace SemFre.Models;

public class FriendPair
{
    public int Friend1ID { get; set; }
    public int Friend2ID { get; set; }
    public DateTime EstablishedAt { get; set; } = DateTime.UtcNow;

    public User? Friend1 { get; set; }
    public User? Friend2 { get; set; }
}
