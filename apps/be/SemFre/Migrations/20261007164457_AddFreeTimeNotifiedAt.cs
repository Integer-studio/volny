using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SemFre.Migrations
{
    /// <inheritdoc />
    public partial class AddFreeTimeNotifiedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "NotifiedAt",
                table: "FreeTimes",
                type: "TEXT",
                nullable: true);

            // Every existing slot was either already announced when it was
            // created (start = now) or created by a client that never planned
            // ahead. Without this, the first FreeTimeActivationService tick
            // after deploy would ping friends again for everyone free right now.
            migrationBuilder.Sql("""
                UPDATE "FreeTimes" SET "NotifiedAt" = "StartTime";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NotifiedAt",
                table: "FreeTimes");
        }
    }
}
