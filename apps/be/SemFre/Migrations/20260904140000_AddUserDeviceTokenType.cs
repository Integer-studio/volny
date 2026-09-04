using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SemFre.Migrations
{
    /// <inheritdoc />
    public partial class AddUserDeviceTokenType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Every row that exists today passed Expo-only validation, so "expo" is a
            // correct default for the whole existing table, not just new rows.
            migrationBuilder.AddColumn<string>(
                name: "TokenType",
                table: "UserDevices",
                type: "TEXT",
                maxLength: 20,
                nullable: false,
                defaultValue: "expo");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TokenType",
                table: "UserDevices");
        }
    }
}
