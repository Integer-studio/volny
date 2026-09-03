using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SemFre.Migrations
{
    /// <inheritdoc />
    public partial class AddFriends : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FriendPairs",
                columns: table => new
                {
                    Friend1ID = table.Column<int>(type: "INTEGER", nullable: false),
                    Friend2ID = table.Column<int>(type: "INTEGER", nullable: false),
                    EstablishedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FriendPairs", x => new { x.Friend1ID, x.Friend2ID });
                    table.CheckConstraint("CK_FriendPair_Order", "Friend1ID < Friend2ID");
                    table.ForeignKey(
                        name: "FK_FriendPairs_Users_Friend1ID",
                        column: x => x.Friend1ID,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FriendPairs_Users_Friend2ID",
                        column: x => x.Friend2ID,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FriendSuggestions",
                columns: table => new
                {
                    SuggesterID = table.Column<int>(type: "INTEGER", nullable: false),
                    SuggestedID = table.Column<int>(type: "INTEGER", nullable: false),
                    SuggestedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FriendSuggestions", x => new { x.SuggesterID, x.SuggestedID });
                    table.CheckConstraint("CK_FriendSuggestion_NotSelf", "SuggesterID != SuggestedID");
                    table.ForeignKey(
                        name: "FK_FriendSuggestions_Users_SuggestedID",
                        column: x => x.SuggestedID,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FriendSuggestions_Users_SuggesterID",
                        column: x => x.SuggesterID,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FriendPairs_Friend2ID",
                table: "FriendPairs",
                column: "Friend2ID");

            migrationBuilder.CreateIndex(
                name: "IX_FriendSuggestions_SuggestedID",
                table: "FriendSuggestions",
                column: "SuggestedID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FriendPairs");

            migrationBuilder.DropTable(
                name: "FriendSuggestions");
        }
    }
}
