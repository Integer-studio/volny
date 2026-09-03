using System;

namespace SemFre.Dtos;

public class DeviceDto
{
    public int DeviceID { get; set; }
    public int UserID { get; set; }
    public string DeviceToken { get; set; } = null!;
    public string? Platform { get; set; }
    public DateTime LastActive { get; set; }
}

public class DeviceCreateDto
{
    public string DeviceToken { get; set; } = null!;
    public string? Platform { get; set; }
}
