using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SemFre.Migrations
{
    /// <inheritdoc />
    public partial class AddPresets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Presets",
                columns: table => new
                {
                    PresetID = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserID = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    Icon = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Minute = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Presets", x => x.PresetID);
                    table.ForeignKey(
                        name: "FK_Presets_Users_UserID",
                        column: x => x.UserID,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Presets_UserID_Minute",
                table: "Presets",
                columns: new[] { "UserID", "Minute" },
                unique: true);

            // Every existing user gets the defaults that used to be hardcoded
            // on the FE, so nobody's list empties out on deploy. A frozen copy
            // of DefaultPresets on purpose: a migration must not change
            // meaning when that class does later. After this, an empty list
            // means the user deleted everything - there's no lazy seeding.
            migrationBuilder.Sql("""
                INSERT INTO "Presets" ("UserID", "Name", "Icon", "Minute")
                SELECT u."UserID", d."Name", d."Icon", d."Minute"
                FROM "Users" u
                CROSS JOIN (
                    SELECT 'Ráno' AS "Name", 'sunrise' AS "Icon", 480 AS "Minute"
                    UNION ALL SELECT 'Poledne', 'sun', 720
                    UNION ALL SELECT 'Odpoledne', 'house', 960
                    UNION ALL SELECT 'Večer', 'sunset', 1260
                    UNION ALL SELECT 'Půlnoc', 'moon-star', 0
                ) d;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Presets");
        }
    }
}
