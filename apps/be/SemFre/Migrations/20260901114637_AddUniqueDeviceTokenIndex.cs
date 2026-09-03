using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SemFre.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueDeviceTokenIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop tokens left over from the discontinued FCM flow: they can never
            // be delivered through Expo and would only pollute the unique index.
            migrationBuilder.Sql(@"
                DELETE FROM UserDevices
                WHERE DeviceToken NOT LIKE 'ExponentPushToken[%]'
                  AND DeviceToken NOT LIKE 'ExpoPushToken[%]';");

            // De-duplicate: keep the most recently inserted row per token.
            // Must run BEFORE the unique index or Migrate() fails on startup.
            migrationBuilder.Sql(@"
                DELETE FROM UserDevices
                WHERE DeviceID NOT IN (
                    SELECT MAX(DeviceID) FROM UserDevices GROUP BY DeviceToken
                );");

            migrationBuilder.CreateIndex(
                name: "IX_UserDevices_DeviceToken",
                table: "UserDevices",
                column: "DeviceToken",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserDevices_DeviceToken",
                table: "UserDevices");
        }
    }
}
