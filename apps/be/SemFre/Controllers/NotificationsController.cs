using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SemFre.Services;

namespace SemFre.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly NotificationQueue _queue;

    public NotificationsController(NotificationQueue queue)
    {
        _queue = queue;
    }

    [HttpGet("stats")]
    [Authorize(Policy = "NotificationsAdmin")]
    public IActionResult Stats()
    {
        var (pending, dlq) = _queue.GetStats();
        return Ok(new { pending, deadLetterCount = dlq });
    }

    [HttpGet("dlq")]
    [Authorize(Policy = "NotificationsAdmin")]
    public IActionResult DeadLetters()
    {
        var list = _queue.GetDeadLetters().Select(d => new
        {
            recipientUserId = d.Notification.RecipientUserId,
            message = d.Notification.Message,
            reason = d.Reason,
            failedAt = d.FailedAt
        });
        return Ok(list);
    }
}
