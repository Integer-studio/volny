namespace SemFre.Dtos;

/// <summary>Body shape for both POST /auth/refresh and POST /auth/logout - both only need the raw refresh token.</summary>
public class RefreshTokenDto
{
    public string RefreshToken { get; set; } = null!;
}

/// <summary>Body shape for POST /auth/handoff/redeem.</summary>
public class HandoffRedeemDto
{
    public string Code { get; set; } = null!;
}
