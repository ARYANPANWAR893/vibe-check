import { paypal } from "@/lib/services";

export async function POST(req: Request) {
  const { orderID } = await req.json();
  if (typeof orderID !== "string" || !/^[A-Z0-9]+$/.test(orderID))
    return Response.json({ error: "bad order id" }, { status: 400 });
  try {
    const capture = await paypal(`/v2/checkout/orders/${orderID}/capture`, {});
    return Response.json({ status: capture.status, id: capture.id, payer: capture.payer?.name?.given_name });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
