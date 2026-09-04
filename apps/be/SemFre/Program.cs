using Microsoft.EntityFrameworkCore;
using SemFre.Data;
using SemFre.Repositories;
using System.Reflection;
using Microsoft.OpenApi.Models;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.RateLimiting;
using System.Text;
using System.Threading.RateLimiting;
using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "SemFre API",
        Version = "v1",
        Description = "SemFre API documentation"
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        c.IncludeXmlComments(xmlPath);
    // Add JWT bearer support to Swagger
    var jwtSecurityScheme = new OpenApiSecurityScheme
    {
        Scheme = "bearer",
        BearerFormat = "JWT",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Description = "Enter 'Bearer' [space] and then your valid token in the text input below.\r\n\r\nExample: \"Bearer eyJhbGci...\"",
        Reference = new OpenApiReference
        {
            Id = "Bearer",
            Type = ReferenceType.SecurityScheme
        }
    };

    c.AddSecurityDefinition(jwtSecurityScheme.Reference.Id, jwtSecurityScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { jwtSecurityScheme, Array.Empty<string>() }
    });
});

// Configure DbContext. Fail fast rather than silently starting with a fresh,
// empty database on ephemeral storage - that is exactly what happened before
// the Azure Files volume was wired up.
var sqliteConn = builder.Configuration.GetConnectionString("SqliteConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:SqliteConnection is not configured.");

var dbPath = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder(sqliteConn).DataSource;
if (!builder.Environment.IsDevelopment() && !Path.IsPathRooted(dbPath))
{
    throw new InvalidOperationException(
        $"Refusing to start: SQLite path '{dbPath}' is relative and would live on ephemeral container storage.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(sqliteConn).AddInterceptors(new SemFre.Data.SqliteBusyTimeoutInterceptor()));

builder.Services.AddScoped(typeof(IRepository<>), typeof(GenericRepository<>));
builder.Services.AddScoped<SemFre.Services.ITokenService, SemFre.Services.TokenService>();
builder.Services.AddScoped<SemFre.Services.IAccessValidator, SemFre.Services.AccessValidator>();
builder.Services.AddScoped<SemFre.Services.IConnectionService, SemFre.Services.ConnectionService>();

// Notification services: queue, background worker and provider selection (Expo or No-op)
builder.Services.AddSingleton<SemFre.Services.NotificationQueue>();
builder.Services.AddHttpClient(SemFre.Services.ExpoPushNotificationService.HttpClientName, client =>
{
    client.BaseAddress = new Uri("https://exp.host/");
    client.Timeout = TimeSpan.FromSeconds(30);
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
    client.DefaultRequestHeaders.AcceptEncoding.ParseAdd("gzip, deflate");
})
.ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
{
    AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate
});

var expoOptions = new SemFre.Services.ExpoPushOptions
{
    Enabled = builder.Configuration.GetValue<bool>("Expo:Enabled"),
    AccessToken = builder.Configuration["Expo:AccessToken"],
    ChannelId = builder.Configuration["Expo:ChannelId"] ?? "default"
};
builder.Services.AddSingleton(expoOptions);
builder.Services.AddSingleton<SemFre.Services.ExpoPushNotificationService>();
builder.Services.AddSingleton<SemFre.Services.NoopNotificationService>();
builder.Services.AddSingleton(sp => new SemFre.Services.NotificationServiceDispatcher.ExpoOrNoop(
    expoOptions.Enabled
        ? sp.GetRequiredService<SemFre.Services.ExpoPushNotificationService>()
        : sp.GetRequiredService<SemFre.Services.NoopNotificationService>()));

// FCM (web push): the whole service account JSON is one config value/env var (see
// .gitignore's "Firebase service account key (FCM V1)" hint) - there is no file-mount
// convention in this project, so a mounted-secret-file approach would be inconsistent.
var fcmServiceAccountJson = builder.Configuration["Fcm:ServiceAccountJson"];
if (!string.IsNullOrWhiteSpace(fcmServiceAccountJson))
{
    var firebaseApp = FirebaseApp.Create(new AppOptions
    {
        Credential = GoogleCredential.FromJson(fcmServiceAccountJson)
    });
    builder.Services.AddSingleton(FirebaseMessaging.GetMessaging(firebaseApp));
    builder.Services.AddSingleton<SemFre.Services.FcmWebPushNotificationService>();
    builder.Services.AddSingleton(sp => new SemFre.Services.NotificationServiceDispatcher.FcmWebOrNoop(
        sp.GetRequiredService<SemFre.Services.FcmWebPushNotificationService>()));
}
else
{
    builder.Services.AddSingleton(sp => new SemFre.Services.NotificationServiceDispatcher.FcmWebOrNoop(
        sp.GetRequiredService<SemFre.Services.NoopNotificationService>()));
}

builder.Services.AddSingleton<SemFre.Services.INotificationService, SemFre.Services.NotificationServiceDispatcher>();
builder.Services.AddHostedService<SemFre.Background.NotificationBackgroundService>();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key missing");
var issuer = builder.Configuration["Jwt:Issuer"];
var audience = builder.Configuration["Jwt:Audience"];
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true
        };
    });

var adminUserIds = (builder.Configuration["Notifications:AdminUserIds"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .ToHashSet(StringComparer.Ordinal);

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("NotificationsAdmin", policy =>
        policy.RequireAssertion(ctx =>
        {
            if (adminUserIds.Count == 0) return false; // fail closed
            var sub = ctx.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                   ?? ctx.User.FindFirst("sub")?.Value;
            return sub != null && adminUserIds.Contains(sub);
        }));
});

// AutoMapper
builder.Services.AddAutoMapper(typeof(SemFre.Profiles.MappingProfile));

// FluentValidation
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<SemFre.Validators.UserRegisterDtoValidator>();

// Invite codes shrank from an 8-char random alphabet (~1.7 trillion
// combinations) to a 6-char CVCVCV slug (~614k) for readability - that's
// small enough that brute-forcing GET /api/groups/invite/{code} (anonymous,
// no auth) becomes plausible without a limit. 20 req/min/IP is generous for
// a human pasting/retyping a code, not for scanning the whole slug space.
builder.Services.AddRateLimiter(options =>
{
    // Partitioned by remote IP - AddFixedWindowLimiter's shorthand would
    // instead be one shared counter for every caller, which isn't what
    // "per IP" means.
    options.AddPolicy("InvitePreview", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = 20,
                QueueLimit = 0,
            }));
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(
                  "https://thankful-forest-019ea4310.6.azurestaticapps.net",
                  "https://volny.intstudio.cz")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "SemFre API v1");
        c.RoutePrefix = string.Empty; // serve Swagger UI at application root
    });
}

app.UseHttpsRedirection();

app.UseCors();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Run migrations. Seed a dev-only admin account - now that the database
// persists, seeding this in production would create a permanent account
// with a hardcoded, publicly-known password.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    if (app.Environment.IsDevelopment() && !db.Users.Any())
    {
        db.Users.Add(new SemFre.Models.User { Username = "admin", PasswordHash = SemFre.Services.PasswordHasher.Hash("admin123"), Name = "Administrator" });
        db.SaveChanges();
    }
}

app.MapControllers();

app.Run();
