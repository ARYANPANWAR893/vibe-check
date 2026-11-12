// Server-only helpers for Groq (AI stylist), Channel3 (products) and PayPal (checkout).

const C3 = "https://api.trychannel3.com";
const PAYPAL = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

export type Item = {
  id: string;
  name: string;
  why: string;
  title: string;
  price: number;
  store: string;
  url: string;
  image: string;
  sticker: string;
  x: number;
  y: number;
};

type Pick = { query: string; name: string; why: string; max_price: number; x: number; y: number };
export type StylePlan = { scene: string; message: string; items: Pick[] };

// ---------- Groq ----------

const STYLIST_PROMPT = `You are a playful Gen-Z stylist for rooms, outfits and desk setups.
Look at the user's photo and restyle it into the requested vibe using 5 purchasable products
that suit what is in the photo and fit the total budget (USD).
Reply ONLY with JSON:
{"scene":"one short sentence about what you see",
 "message":"2 sentence fun stylist note, lowercase, 1-2 emoji",
 "items":[{"query":"specific product search query, 3-6 words","name":"short cute name, lowercase",
   "why":"why it fits, max 12 words","max_price":number,"x":0-100,"y":0-100}]}
x,y = percent position in the photo where the item would go. The sum of max_price must be <= budget.
For an outfit, suggest wearable items and accessories; for a desk, desk gear and decor.`;

export async function planStyle(image: string, canvas: string, vibe: string, budget: number): Promise<StylePlan> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b",
      max_tokens: 1500,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STYLIST_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `canvas: ${canvas}. vibe: ${vibe}. budget: $${budget}` },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    }),
  });
  const data = await res.json();
  const choice = data.choices?.[0];
  if (!res.ok || !choice) throw new Error(data.error?.message ?? "stylist failed");
  if (choice.finish_reason === "length") throw new Error("stylist reply was cut off");
  return JSON.parse(choice.message.content);
}

// ---------- Channel3 ----------

type C3Product = {
  id: string;
  title: string;
  images: { url: string; cleaned_url: string | null; shot_type: string }[];
  offers: { url: string; domain: string; price: { price: number; currency: string }; availability: string }[];
};

async function c3(path: string, body?: object) {
  const res = await fetch(C3 + path, {
    method: body ? "POST" : "GET",
    headers: { "x-api-key": process.env.CHANNEL3_API_KEY!, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`channel3 ${path} ${res.status}`);
  return res.json();
}

function cheapestOffer(p: C3Product) {
  const usd = p.offers.filter((o) => o.price.currency === "USD" && o.availability !== "OutOfStock" && o.availability !== "SoldOut");
  return usd.sort((a, b) => a.price.price - b.price.price)[0];
}

function bestImage(p: C3Product) {
  const hero = p.images.find((i) => i.shot_type === "hero" && i.cleaned_url) ?? p.images.find((i) => i.shot_type !== "size_chart");
  return hero?.cleaned_url ?? hero?.url ?? p.images[0]?.url ?? "";
}

export async function searchProducts(query: string, maxPrice: number, limit = 4): Promise<C3Product[]> {
  const data = await c3("/v1/search", {
    query,
    limit,
    filters: { price: { max_price: maxPrice }, availability: ["InStock", "LimitedAvailability"] },
  });
  return (data.products as C3Product[]).filter(cheapestOffer);
}

export async function sticker(productId: string): Promise<string | null> {
  try {
    return (await c3("/experimental/sticker", { product_id: productId })).sticker_url;
  } catch {
    return null; // not every product can be cut out; the UI falls back to the product photo
  }
}

export async function toItem(p: C3Product, pick: Pick, withSticker = true): Promise<Item> {
  const offer = cheapestOffer(p);
  const image = bestImage(p);
  return {
    id: p.id,
    name: pick.name,
    why: pick.why,
    title: p.title,
    price: offer.price.price,
    store: offer.domain,
    url: offer.url,
    image,
    sticker: (withSticker && (await sticker(p.id))) || image,
    x: pick.x,
    y: pick.y,
  };
}

/** Re-reads the live price from Channel3 so the client can never set its own prices. */
export async function livePrice(productId: string) {
  const p: C3Product = await c3(`/v1/products/${encodeURIComponent(productId)}`);
  const offer = cheapestOffer(p);
  if (!offer) throw new Error(`${p.title} is out of stock`);
  return { title: p.title, price: offer.price.price };
}

// ---------- PayPal ----------

async function paypalToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? "paypal auth failed");
  return data.access_token as string;
}

export async function paypal(path: string, body: object) {
  const res = await fetch(PAYPAL + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${await paypalToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.details?.[0]?.description ?? data.message ?? "paypal request failed");
  return data;
}
