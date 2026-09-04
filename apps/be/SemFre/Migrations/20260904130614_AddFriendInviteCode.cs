using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SemFre.Migrations
{
    /// <inheritdoc />
    public partial class AddFriendInviteCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FriendInviteCode",
                table: "Users",
                type: "TEXT",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FriendInviteCodeGeneratedAt",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_FriendInviteCode",
                table: "Users",
                column: "FriendInviteCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_FriendInviteCode",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "FriendInviteCode",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "FriendInviteCodeGeneratedAt",
                table: "Users");
        }
    }
}
