using System.Security.Cryptography;

namespace SemFre.Services;

public static class InviteCodeGenerator
{
    // Consonant/vowel alternation (CVCVCV) so the code reads as a
    // pronounceable made-up word (e.g. "belako") instead of a random
    // string - easier to say aloud, remember, and type by hand.
    // Consonants: no q/w/x/y (foreign to Czech spelling).
    private const string Consonants = "bcdfghjklmnprstvz";
    private const string Vowels = "aeiou";
    private const int Syllables = 3; // CVCVCV = 6 chars, 17^3 * 5^3 ~= 614k combinations

    // Blocklist of syllable sequences that land on a real (or vulgar) Czech
    // word once assembled - checked against the generated code as a whole
    // substring match, cheap enough at this length.
    private static readonly string[] Blocklist = ["kokot", "piča", "kurva", "debil", "sracka", "buzik"];

    public static string Generate()
    {
        string code;
        do
        {
            var chars = new char[Syllables * 2];
            var c = RandomNumberGenerator.GetItems<char>(Consonants, Syllables);
            var v = RandomNumberGenerator.GetItems<char>(Vowels, Syllables);
            for (var i = 0; i < Syllables; i++)
            {
                chars[i * 2] = c[i];
                chars[i * 2 + 1] = v[i];
            }
            code = new string(chars);
        } while (Blocklist.Any(code.Contains));

        return code;
    }

    /// <summary>
    /// Trims, strips separators, lowercases - so a copy-pasted or hand-typed
    /// code still matches. Lowercase (not uppercase) because new codes are
    /// generated lowercase; legacy 8-char codes are normalized to lowercase
    /// too (see the AddLowercaseInviteCodes migration), so a single
    /// lowercase comparison covers both formats.
    /// </summary>
    public static string Normalize(string code) =>
        code.Trim().Replace("-", "").Replace(" ", "").ToLowerInvariant();
}
