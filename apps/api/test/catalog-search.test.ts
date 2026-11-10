import { expect, it, vi } from 'vitest';
import { CatalogService } from '../src/modules/catalog/catalog.service.js';
import type { DatabaseService } from '../src/database/database.service.js';

it('searches public names, descriptions, categories and active references with bound parameters', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const service = new CatalogService({ query } as unknown as DatabaseService);
  const search = "' OR true --";
  await service.publicProducts({ q: search, limit: 6, offset: 0, sort: 'newest' });
  const [sql, values] = query.mock.calls[0]! as [string, unknown[]];
  expect(sql).toContain("p.status = 'published' AND c.is_visible = true");
  expect(sql).toContain("c.name ILIKE '%' || $2 || '%'");
  expect(sql).toContain('s.is_active=true');
  expect(sql).toContain('ORDER BY CASE WHEN $2::text IS NOT NULL');
  expect(sql).toContain("s.sku ILIKE '%' || $2 || '%'");
  expect(sql).toContain("s.name ILIKE '%' || $2 || '%'");
  expect(sql).not.toContain(search);
  expect(values.slice(0, 4)).toEqual([null, search, 6, 0]);
});
