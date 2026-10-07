using FluentValidation;
using SemFre.Dtos;

namespace SemFre.Validators;

public class FreeTimeCreateDtoValidator : AbstractValidator<FreeTimeCreateDto>
{
    /// <summary>Free time can be planned at most this far ahead (task 0008) - both its start and its end.</summary>
    public static readonly TimeSpan MaxAhead = TimeSpan.FromHours(24);

    // Slack for the client clock and request latency: the FE clamps to exactly
    // now + 24 h by its own clock, which may run a little ahead of ours.
    private static readonly TimeSpan Tolerance = TimeSpan.FromMinutes(5);

    public FreeTimeCreateDtoValidator()
    {
        RuleFor(x => x.StartTime).Must(dt => dt == null || dt.Value.Kind == System.DateTimeKind.Utc).WithMessage("StartTime must be UTC or null");
        RuleFor(x => x.EndTime).Must(dt => dt == null || dt.Value.Kind == System.DateTimeKind.Utc).WithMessage("EndTime must be UTC or null");
        RuleFor(x => x).Must(x => x.EndTime == null || x.StartTime == null || x.EndTime >= x.StartTime).WithMessage("EndTime must be after StartTime");
        RuleFor(x => x.StartTime).Must(WithinWindow).WithMessage("StartTime can be at most 24 hours ahead");
        RuleFor(x => x.EndTime).Must(WithinWindow).WithMessage("EndTime can be at most 24 hours ahead");
    }

    private static bool WithinWindow(DateTime? dt) => dt == null || dt.Value <= DateTime.UtcNow + MaxAhead + Tolerance;
}
