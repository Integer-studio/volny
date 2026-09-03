using Microsoft.AspNetCore.Mvc;
using SemFre.Models;
using SemFre.Repositories;

namespace SemFre.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IRepository<Product> _repo;

    public ProductsController(IRepository<Product> repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? q = null)
    {
        var items = await _repo.GetAllAsync();
        if (!string.IsNullOrEmpty(q))
            items = items.Where(p => p.Name.Contains(q, StringComparison.OrdinalIgnoreCase));
        return Ok(items);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var item = await _repo.GetByIdAsync(id);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Product product)
    {
        await _repo.AddAsync(product);
        await _repo.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = product.Id }, product);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Product product)
    {
        var existing = await _repo.GetByIdAsync(id);
        if (existing == null) return NotFound();
        product.Id = id;
        _repo.Update(product);
        await _repo.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await _repo.GetByIdAsync(id);
        if (existing == null) return NotFound();
        _repo.Remove(existing);
        await _repo.SaveChangesAsync();
        return NoContent();
    }
}
