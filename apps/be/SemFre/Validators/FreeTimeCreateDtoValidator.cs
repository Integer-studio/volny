using FluentValidation;
using SemFre.Dtos;

namespace SemFre.Validators;

public class FreeTimeCreateDtoValidator : AbstractValidator<FreeTimeCreateDto>
{
    public FreeTimeCreateDtoValidator()
    {
        RuleFor(x => x.StartTime).Must(dt => dt == null || dt.Value.Kind == System.DateTimeKind.Utc).WithMessage("StartTime must be UTC or null");
        RuleFor(x => x.EndTime).Must(dt => dt == null || dt.Value.Kind == System.DateTimeKind.Utc).WithMessage("EndTime must be UTC or null");
        RuleFor(x => x).Must(x => x.EndTime == null || x.StartTime == null || x.EndTime >= x.StartTime).WithMessage("EndTime must be after StartTime");
    }
}
