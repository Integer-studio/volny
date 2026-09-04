using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using SemFre.Models;

namespace SemFre.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; } = null!;

    public DbSet<Product> Products { get; set; } = null!;
    public DbSet<UserDevice> UserDevices { get; set; } = null!;
    public DbSet<FreeTime> FreeTimes { get; set; } = null!;
    public DbSet<FriendPair> FriendPairs { get; set; } = null!;
    public DbSet<FriendSuggestion> FriendSuggestions { get; set; } = null!;
    public DbSet<Group> Groups { get; set; } = null!;
    public DbSet<GroupMember> GroupMembers { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<FriendPair>(entity =>
        {
            entity.HasKey(e => new { e.Friend1ID, e.Friend2ID });
            entity.HasOne(e => e.Friend1).WithMany().HasForeignKey(e => e.Friend1ID).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Friend2).WithMany().HasForeignKey(e => e.Friend2ID).OnDelete(DeleteBehavior.Cascade);
            entity.HasCheckConstraint("CK_FriendPair_Order", "Friend1ID < Friend2ID");
        });

        modelBuilder.Entity<FriendSuggestion>(entity =>
        {
            entity.HasKey(e => new { e.SuggesterID, e.SuggestedID });
            entity.HasOne(e => e.Suggester).WithMany().HasForeignKey(e => e.SuggesterID).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Suggested).WithMany().HasForeignKey(e => e.SuggestedID).OnDelete(DeleteBehavior.Cascade);
            entity.HasCheckConstraint("CK_FriendSuggestion_NotSelf", "SuggesterID != SuggestedID");
        });

        modelBuilder.Entity<UserDevice>(entity =>
        {
            entity.Property(e => e.DeviceToken).HasMaxLength(255).IsRequired();
            entity.HasIndex(e => e.DeviceToken).IsUnique();
            entity.Property(e => e.Platform).HasMaxLength(50);
            entity.Property(e => e.TokenType).HasMaxLength(20).IsRequired().HasDefaultValue("expo");
        });

        // Case-insensitive uniqueness on Username is enforced by a raw-SQL
        // expression index (CREATE UNIQUE INDEX ... COLLATE NOCASE) in the
        // AddUniqueUsernameIndex migration, not here. SQLite has no model-level
        // API for a per-index collation, and UseCollation on the property would
        // force a full table rebuild (Users is the FK principal for FreeTimes,
        // UserDevices, FriendPairs and FriendSuggestions). Queries must match it
        // with EF.Functions.Collate(u.Username, "NOCASE") to use the index.
        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(e => e.Username).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Phone).HasMaxLength(32);
            entity.Property(e => e.Instagram).HasMaxLength(64);
            entity.Property(e => e.FriendInviteCode).HasMaxLength(16);
            entity.HasIndex(e => e.FriendInviteCode).IsUnique();
        });

        modelBuilder.Entity<Group>(entity =>
        {
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.InviteCode).HasMaxLength(16).IsRequired();
            entity.HasIndex(e => e.InviteCode).IsUnique();
            entity.HasOne(e => e.Owner).WithMany().HasForeignKey(e => e.OwnerID).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GroupMember>(entity =>
        {
            entity.HasKey(e => new { e.GroupID, e.UserID });
            entity.HasOne(e => e.Group).WithMany(g => g.Members).HasForeignKey(e => e.GroupID).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserID).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.UserID);
        });

        // SQLite stores DateTime as TEXT and EF materializes it as
        // DateTimeKind.Unspecified, so System.Text.Json serializes it with no
        // "Z"/offset - the FE then reads it as local time (wrong by the UTC
        // offset). Every DateTime in this app is UTC in practice (see
        // FreeTimeCreateDtoValidator, which already requires Utc-kinded
        // input); this just makes EF say so on the way out. The provider
        // type is unchanged (DateTime -> DateTime), so this must NOT produce
        // a migration - verify with `dotnet ef migrations add` and confirm
        // Up()/Down() are empty before deploying.
        var utcConverter = new ValueConverter<DateTime, DateTime>(
            v => v,
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        var utcNullableConverter = new ValueConverter<DateTime?, DateTime?>(
            v => v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                {
                    property.SetValueConverter(utcConverter);
                }
                else if (property.ClrType == typeof(DateTime?))
                {
                    property.SetValueConverter(utcNullableConverter);
                }
            }
        }
    }
}
