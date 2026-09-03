using FluentValidation;
using SemFre.Dtos;
using SemFre.Services;

namespace SemFre.Validators;

public class DeviceCreateDtoValidator : AbstractValidator<DeviceCreateDto>
{
    private static readonly string[] AllowedPlatforms = { "android", "ios", "web" };

    public DeviceCreateDtoValidator()
    {
        RuleFor(x => x.DeviceToken)
            .NotEmpty().WithMessage("DeviceToken je povinný.")
            .MaximumLength(255).WithMessage("DeviceToken může mít nejvýš 255 znaků.")
            .Must(ExpoPushNotificationService.IsValidExpoToken)
            .WithMessage("DeviceToken must be an Expo push token, e.g. ExponentPushToken[xxxxxxxx].");

        RuleFor(x => x.Platform)
            .MaximumLength(50).WithMessage("Platform může mít nejvýš 50 znaků.")
            .Must(p => p == null || System.Array.Exists(AllowedPlatforms,
                a => string.Equals(a, p, System.StringComparison.OrdinalIgnoreCase)))
            .WithMessage("Platform must be one of: android, ios, web.")
            .When(x => x.Platform != null);
    }
}
