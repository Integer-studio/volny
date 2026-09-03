using FluentValidation;
using SemFre.Dtos;

namespace SemFre.Validators;

public class GroupCreateDtoValidator : AbstractValidator<GroupCreateDto>
{
    public GroupCreateDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Zadej název skupiny.")
            .MaximumLength(100).WithMessage("Název skupiny může mít nejvýš 100 znaků.");
    }
}
