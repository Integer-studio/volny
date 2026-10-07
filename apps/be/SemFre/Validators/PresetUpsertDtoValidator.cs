using FluentValidation;
using SemFre.Dtos;
using SemFre.Services;

namespace SemFre.Validators;

public class PresetUpsertDtoValidator : AbstractValidator<PresetUpsertDto>
{
    public PresetUpsertDtoValidator()
    {
        RuleFor(x => x.Name).Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Zadej název.")
            .MaximumLength(30).WithMessage("Název může mít nejvýš 30 znaků.");
        RuleFor(x => x.Icon).Must(i => DefaultPresets.IconKeys.Contains(i)).WithMessage("Neznámá ikonka.");
        RuleFor(x => x.Minute).InclusiveBetween(0, 24 * 60 - 1).WithMessage("Čas musí být mezi 0:00 a 23:45.")
            .Must(m => m % 15 == 0).WithMessage("Čas musí být po čtvrthodinách.");
    }
}
