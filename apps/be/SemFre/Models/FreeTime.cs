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

    // Navigation
    public User? User { get; set; }
}
