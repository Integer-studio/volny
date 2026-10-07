namespace SemFre.Dtos;

public class PresetDto
{
    public int PresetID { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public int Minute { get; set; }
}

public class PresetUpsertDto
{
    public string Name { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public int Minute { get; set; }
}
