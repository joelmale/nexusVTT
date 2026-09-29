import { readFileSync } from 'fs';
import { join } from 'path';

// doc-api/prisma owns migrations. doc-processor generates its client from a
// copy (a symlink does not survive Windows checkouts or the Docker build
// context), so the copy must stay byte-identical to the owner.
describe('prisma schema sync', () => {
  it('doc-processor schema matches the doc-api schema', () => {
    const normalize = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
    const owner = normalize(join(__dirname, '../../../doc-api/prisma/schema.prisma'));
    const copy = normalize(join(__dirname, '../../prisma/schema.prisma'));

    expect(copy).toBe(owner);
  });
});
