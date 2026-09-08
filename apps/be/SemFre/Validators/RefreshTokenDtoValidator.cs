using FluentValidation;
using SemFre.Dtos;

namespace SemFre.Validators;

public class RefreshTokenDtoValidator : AbstractValidator<RefreshTokenDto>
{
    public RefreshTokenDtoValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty().WithMessage("Chybí refresh token.");
    }
}
