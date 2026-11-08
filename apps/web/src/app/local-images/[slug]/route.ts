import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const types: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return new Response(null, { status: 404 });
  // pnpm runs Next from apps/web; the shared public directory is at the workspace root.
  const root = await realpath(path.resolve(process.cwd(), '../../public'));
  for (const [extension, contentType] of Object.entries(types)) {
    try {
      const file = await realpath(path.join(root, 'products', `${slug}.${extension}`));
      if (!file.startsWith(root + path.sep)) continue;
      return new Response(new Uint8Array(await readFile(file)), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    } catch {
      /* Try the next supported extension. */
    }
  }
  return new Response(new Uint8Array(await readFile(path.join(root, 'logo/logo-enhanced.png'))), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
