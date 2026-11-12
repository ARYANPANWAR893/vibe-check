import { livePrice, paypal } from "@/lib/services";

// Creates ONE PayPal order for the whole look. Prices are re-read from Channel3, never trusted from the client.
export async function POST(req: Request) {
  const { ids, vibe } = await req.json();
  if (!Array.isArray(ids) || !ids.length || ids.length > 10)
    return Response.json({ error: "your bag is empty" }, { status: 400 });

  try {
    const lines = await Promise.all(ids.map((id: unknown) => livePrice(String(id))));
    const total = lines.reduce((sum, l) => sum + l.price, 0).toFixed(2);
    const order = await paypal("/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [
        {
          description: `vibe check: ${String(vibe).slice(0, 60)} kit`,
          amount: {
            currency_code: "USD",
            value: total,
            breakdown: { item_total: { currency_code: "USD", value: total } },
          },
          items: lines.map((l, i) => ({
            name: l.title.slice(0, 127),
            sku: String(ids[i]), // Channel3 product id, so the agent can re-check stock after payment
            quantity: "1",
            category: "PHYSICAL_GOODS",
            unit_amount: { currency_code: "USD", value: l.price.toFixed(2) },
          })),
        },
      ],
    });
    return Response.json({ id: order.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
