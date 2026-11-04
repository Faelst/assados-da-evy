import { readFile } from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function GET(_: Request, { params }: RouteContext<"/api/uploads/[name]">) {
  const { name } = await params;
  if (!/^[\w-]+\.(jpe?g|png|webp)$/i.test(name)) return new Response("Not found", { status: 404 });
  try {
    const file = await readFile(path.join(UPLOAD_DIR, name));
    return new Response(file, {
      headers: { "content-type": TYPES[path.extname(name).toLowerCase()], "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
