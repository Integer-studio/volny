using System;
using System.ComponentModel.DataAnnotations;

namespace SemFre.Models;

public class FreeTime
{
    [Key]
    public int FreeTimeID { get; set; }

    public int UserID { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    /// <summary>
    /// When connections were told "má teď volno" for this slot. Null means a
    /// planned slot that hasn't started yet (or was pushed back into the future
    /// again) - FreeTimeActivationService picks those up once StartTime passes.
    /// </summary>
    public DateTime? NotifiedAt { get; set; }

    // Navigation
    public User? User { get; set; }
}
