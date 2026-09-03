using System;

namespace SemFre.Dtos;

public class FreeTimeDto
{
    public int FreeTimeID { get; set; }
    public int UserID { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
}

public class FreeTimeCreateDto
{
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}
