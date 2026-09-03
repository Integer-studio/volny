using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace SemFre.Data;

/// <summary>
/// Sets a busy timeout on every SQLite connection so transient lock contention
/// (expected on the Azure Files-backed database) retries instead of throwing
/// immediately. Deliberately does not touch journal_mode: WAL is not supported
/// over the SMB mount this database lives on in production.
/// </summary>
public class SqliteBusyTimeoutInterceptor : DbConnectionInterceptor
{
    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        SetBusyTimeout(connection);
    }

    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        await SetBusyTimeoutAsync(connection, cancellationToken);
    }

    private static void SetBusyTimeout(DbConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA busy_timeout=10000;";
        command.ExecuteNonQuery();
    }

    private static async Task SetBusyTimeoutAsync(DbConnection connection, CancellationToken ct)
    {
        var command = connection.CreateCommand();
        await using (command.ConfigureAwait(false))
        {
            command.CommandText = "PRAGMA busy_timeout=10000;";
            await command.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
        }
    }
}
