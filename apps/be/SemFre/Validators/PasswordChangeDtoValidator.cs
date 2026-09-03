using FluentValidation;
using SemFre.Dtos;

namespace SemFre.Validators;

public class PasswordChangeDtoValidator : AbstractValidator<PasswordChangeDto>
{
    public PasswordChangeDtoValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty().WithMessage("Zadej současné heslo.");
        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("Zadej nové heslo.")
            .MinimumLength(4).WithMessage("Heslo musí mít alespoň 4 znaky.")
            .MaximumLength(128).WithMessage("Heslo může mít nejvýš 128 znaků.")
            .NotEqual(x => x.CurrentPassword).WithMessage("Nové heslo musí být jiné než současné.");
    }
}
