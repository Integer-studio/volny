using Microsoft.EntityFrameworkCore;
using SemFre.Data;

namespace SemFre.Repositories;

public class GenericRepository<T> : IRepository<T> where T : class
{
    private readonly AppDbContext _context;
    private readonly DbSet<T> _dbSet;

    public GenericRepository(AppDbContext context)
    {
        _context = context;
        _dbSet = _context.Set<T>();
    }

    public async Task<IEnumerable<T>> GetAllAsync(CancellationToken ct = default)
    {
        return await _dbSet.AsNoTracking().ToListAsync(ct);
    }

    public async Task<T?> GetByIdAsync(object id, CancellationToken ct = default)
    {
        return await _dbSet.FirstOrDefaultAsync(e => EF.Property<object>(e, "Id")!.Equals(id), ct);
    }

    public async Task AddAsync(T entity, CancellationToken ct = default)
    {
        _dbSet.Add(entity);
        await Task.CompletedTask;
    }

    public void Update(T entity)
    {
        _dbSet.Update(entity);
    }

    public void Remove(T entity)
    {
        _dbSet.Remove(entity);
    }

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        await _context.SaveChangesAsync(ct);
    }
}
