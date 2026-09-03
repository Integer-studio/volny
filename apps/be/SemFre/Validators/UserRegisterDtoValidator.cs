using FluentValidation;
using SemFre.Dtos;

namespace SemFre.Validators;

public class UserRegisterDtoValidator : AbstractValidator<UserRegisterDto>
{
    public UserRegisterDtoValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Zadej uživatelské jméno.")
            .MinimumLength(3).WithMessage("Uživatelské jméno musí mít alespoň 3 znaky.")
            .MaximumLength(50).WithMessage("Uživatelské jméno může mít nejvýš 50 znaků.")
            .Matches("^[a-zA-Z0-9._-]+$").WithMessage("Uživatelské jméno smí obsahovat jen písmena, čísla, tečku, pomlčku a podtržítko.");
        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Zadej heslo.")
            .MinimumLength(4).WithMessage("Heslo musí mít alespoň 4 znaky.")
            .MaximumLength(128).WithMessage("Heslo může mít nejvýš 128 znaků.");
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Zadej jméno.")
            .MaximumLength(100).WithMessage("Jméno může mít nejvýš 100 znaků.");
    }
}
