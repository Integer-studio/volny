using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SemFre.Data;

namespace SemFre.Background;

/// <summary>
/// Activates planned free time (task 0008): once a slot's StartTime passes, its
/// connections get the "má teď volno" push and a realtime refetch - whether or
/// not the owner's app is open. A slot is due when it has started, hasn't ended
/// and was never notified (NotifiedAt == null).
/// </summary>
public class FreeTimeActivationService : BackgroundService
{
    // Planned starts snap to quarter hours on the ring, so 30 s of lag is
    // invisible next to a "bude volný od 18:00" label.
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);

    private readonly IServiceProvider _provider;
    private readonly ILogger<FreeTimeActivationService> _log;

    public FreeTimeActivationService(IServiceProvider provider, ILogger<FreeTimeActivationService> log)
    {
        _provider = provider;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await ActivateDueAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _log.LogError(ex, "Activating planned free time failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ActivateDueAsync(CancellationToken ct)
    {
        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var activator = scope.ServiceProvider.GetRequiredService<Services.FreeTimeActivator>();

        var now = DateTime.UtcNow;
        var due = await db.FreeTimes
            .Where(f => f.NotifiedAt == null && f.StartTime <= now && f.EndTime > now)
            .ToListAsync(ct);

        foreach (var ft in due)
        {
            await activator.ActivateAsync(ft);
            _log.LogInformation("Activated planned free time {FreeTimeId} of user {UserId}", ft.FreeTimeID, ft.UserID);
        }
    }
}
