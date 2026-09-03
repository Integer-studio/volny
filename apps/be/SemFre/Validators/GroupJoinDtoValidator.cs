using FluentValidation;
using SemFre.Dtos;

namespace SemFre.Validators;

public class GroupJoinDtoValidator : AbstractValidator<GroupJoinDto>
{
    public GroupJoinDtoValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Zadej kód pozvánky.")
            .MaximumLength(16).WithMessage("Neplatný kód pozvánky.");
    }
}
