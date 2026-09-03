using System;
using System.Security.Cryptography;

namespace SemFre.Services;

public static class PasswordHasher
{
    // PBKDF2 hashing
    public static string Hash(string password)
    {
        var salt = new byte[16];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(salt);
        // PBKDF2 cost for newly created hashes. Verify() reads the iteration
        // count from the stored hash, so this only affects future Hash() calls -
        // existing hashes keep verifying with whatever count they were created with.
        // Kept low (well below current OWASP guidance of 600k) because the
        // Container App runs on 0.25 vCPU (free tier); at 100k iterations login
        // took 0.5-1s of pure CPU time on that hardware.
        const int iterations = 25_000;
        using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
        var subkey = pbkdf2.GetBytes(32);
        return $"{iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(subkey)}";
    }

    public static bool Verify(string hashed, string providedPassword)
    {
        var parts = hashed.Split('.');
        if (parts.Length != 3) return false;
        if (!int.TryParse(parts[0], out var iterations)) return false;
        var salt = Convert.FromBase64String(parts[1]);
        var expected = Convert.FromBase64String(parts[2]);
        using var pbkdf2 = new Rfc2898DeriveBytes(providedPassword, salt, iterations, HashAlgorithmName.SHA256);
        var actual = pbkdf2.GetBytes(expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
