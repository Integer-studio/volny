using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SemFre.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueUsernameIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Case-insensitive unique index on Username. SQLite has no model-level
            // API for a per-index collation (see AppDbContext.OnModelCreating), so
            // this is raw SQL rather than a MigrationBuilder.CreateIndex call.
            //
            // Deliberately NOT pre-cleaning duplicates the way
            // AddUniqueDeviceTokenIndex does for tokens: silently renaming a
            // colliding username would rename someone's login out from under them.
            // If this fails at startup, it means production already has two
            // usernames that only differ by case - back that database up, rename
            // one of them by hand, then let Migrate() retry.
            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX \"IX_Users_Username_NoCase\" ON \"Users\" (\"Username\" COLLATE NOCASE);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_Users_Username_NoCase\";");
        }
    }
}
