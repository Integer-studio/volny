using FluentValidation;
using SemFre.Dtos;

namespace SemFre.Validators;

public class AccountDeleteDtoValidator : AbstractValidator<AccountDeleteDto>
{
    public AccountDeleteDtoValidator()
    {
        RuleFor(x => x.Password).NotEmpty().WithMessage("Zadej heslo.");
    }
}
