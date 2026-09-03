using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SemFre.Migrations
{
    /// <inheritdoc />
    public partial class LowercaseInviteCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Data-only migration, no model change: InviteCodeGenerator now
            // emits lowercase CVCVCV slugs (e.g. "belako") instead of
            // uppercase random strings, and GroupsController now looks codes
            // up case-insensitively (EF.Functions.Collate ... "NOCASE"). This
            // just normalizes existing rows to lowercase too, so old 8-char
            // codes keep matching a lowercased/pasted-back version of
            // themselves - they stay valid, they're just not the CVCVCV
            // shape. IX_Groups_InviteCode stays a plain (case-sensitive)
            // unique index; uniqueness isn't affected since this only
            // changes case, never introduces a collision among existing rows.
            migrationBuilder.Sql("UPDATE \"Groups\" SET \"InviteCode\" = lower(\"InviteCode\");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Case is not recoverable - the pre-migration case is gone.
            // No-op: leaving codes lowercase on downgrade is harmless since
            // lookups always normalize to lowercase anyway.
        }
    }
}
