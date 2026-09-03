using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SemFre.Controllers;

/// <summary>
/// No DB access on purpose - this exists purely to wake a scaled-to-zero
/// Container App and to serve as its startup/readiness probe. A DB-touching
/// endpoint (e.g. GET groups/invite/{code}) would pollute logs with fake
/// failures for random codes and is abuse-sensitive; this one isn't.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { ok = true });
}
