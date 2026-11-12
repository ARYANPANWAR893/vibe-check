import { sticker } from "@/lib/services";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  return Response.json({ sticker: await sticker(id) });
}
