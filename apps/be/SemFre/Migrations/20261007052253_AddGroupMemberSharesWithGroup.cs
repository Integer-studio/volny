using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SemFre.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupMemberSharesWithGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "SharesWithGroup",
                table: "GroupMembers",
                type: "INTEGER",
                nullable: false,
                // true, not EF's generated false: existing members shared
                // with their groups unconditionally before task 0021, so the
                // toggle starts on for them (and for new members, via the
                // model's initializer).
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SharesWithGroup",
                table: "GroupMembers");
        }
    }
}
