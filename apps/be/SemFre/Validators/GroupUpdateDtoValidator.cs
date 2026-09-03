using FluentValidation;
using SemFre.Dtos;

namespace SemFre.Validators;

public class GroupUpdateDtoValidator : AbstractValidator<GroupUpdateDto>
{
    public GroupUpdateDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Název skupiny nemůže být prázdný.")
            .MaximumLength(100).WithMessage("Název skupiny může mít nejvýš 100 znaků.")
            .When(x => x.Name != null);
    }
}
