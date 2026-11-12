import { planStyle, searchProducts, toItem, Item } from "@/lib/services";

export const maxDuration = 60;

// Photo + vibe + budget -> AI plan -> real products (with stickers) + swap alternates per slot.
export async function POST(req: Request) {
  const { image, canvas, vibe, budget } = await req.json();
  if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 4_000_000)
    return Response.json({ error: "please upload a photo under 3MB" }, { status: 400 });
  const cap = Math.min(Math.max(Number(budget) || 100, 20), 2000);

  try {
    const plan = await planStyle(image, String(canvas).slice(0, 20), String(vibe).slice(0, 60), cap);
    const slots = await Promise.all(
      plan.items.slice(0, 6).map(async (pick) => {
        const found = await searchProducts(pick.query, Math.max(pick.max_price, 5)).catch(() => []);
        if (!found.length) return null;
        // lead with a product that cuts out into a clean sticker (try 2 at most)
        let item = await toItem(found[0], pick);
        let lead = 0;
        if (item.sticker === item.image && found[1]) {
          const second = await toItem(found[1], pick);
          if (second.sticker !== second.image) [item, lead] = [second, 1];
        }
        // alternates skip the sticker call until they're actually swapped in (/api/sticker)
        const alternates = await Promise.all(found.filter((_, i) => i !== lead).map((p) => toItem(p, pick, false)));
        return { item, alternates };
      }),
    );
    const filled = slots.filter((s) => s !== null);
    if (!filled.length) return Response.json({ error: "couldn't find products for that vibe, try another" }, { status: 502 });
    return Response.json({
      scene: plan.scene,
      message: plan.message,
      items: filled.map((s) => s.item) satisfies Item[],
      alternates: filled.map((s) => s.alternates),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
