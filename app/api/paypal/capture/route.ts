import { livePrice, paypal, SoldOut } from "@/lib/services";

type Line = { name: string; sku: string; unit_amount: { value: string } };

// Capture the payment, then the agent re-checks stock for every line and
// refunds (via PayPal) anything that sold out before it could be ordered.
export async function POST(req: Request) {
  const { orderID, simulateSoldOut } = await req.json();
  if (typeof orderID !== "string" || !/^[A-Z0-9]+$/.test(orderID))
    return Response.json({ error: "bad order id" }, { status: 400 });

  try {
    const captured = await paypal(`/v2/checkout/orders/${orderID}/capture`, {});
    if (captured.status !== "COMPLETED") return Response.json({ error: `payment ${captured.status.toLowerCase()}` }, { status: 402 });
    const capture = captured.purchase_units[0].payments.captures[0];

    // amounts come from PayPal's own record of the order, never from the client
    const order = await paypal(`/v2/checkout/orders/${orderID}`);
    const unit = order.purchase_units[0];
    const lines: Line[] = unit.items ?? [];

    const checked = await Promise.all(
      lines.map(async (l, i) => {
        let available = true;
        try {
          await livePrice(l.sku);
        } catch (e) {
          available = !(e instanceof SoldOut); // a network blip is not a sell-out
        }
        // demo switch (sandbox only) so the refund path can be shown on camera
        if (simulateSoldOut && i === lines.length - 1 && (process.env.PAYPAL_API_BASE ?? "sandbox").includes("sandbox")) available = false;
        return { id: l.sku, name: l.name, price: Number(l.unit_amount.value), available };
      }),
    );

    const gone = checked.filter((c) => !c.available);
    let refund = null;
    if (gone.length) {
      const value = gone.reduce((s, c) => s + c.price, 0).toFixed(2);
      const r = await paypal(`/v2/payments/captures/${capture.id}/refund`, {
        amount: { value, currency_code: "USD" },
        note_to_payer: `Sorry! ${gone.map((g) => g.name).join(", ").slice(0, 200)} sold out before we could order it.`,
      });
      refund = { id: r.id, status: r.status, amount: Number(value) };
    }

    const addr = unit.shipping?.address;
    return Response.json({
      orderId: orderID,
      captureId: capture.id,
      paid: Number(capture.amount.value),
      payer: captured.payer?.name?.given_name ?? "",
      shipTo: addr ? { name: unit.shipping.name?.full_name ?? "", city: [addr.admin_area_2, addr.admin_area_1].filter(Boolean).join(", ") } : null,
      items: checked,
      refund,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
