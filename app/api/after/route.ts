export const maxDuration = 60;

// "After" photo: Gemini edits the user's photo to include the actual picked products.
export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "no GEMINI_API_KEY" }, { status: 501 });

  const { image, vibe, canvas, items } = await req.json();
  const photo = /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(image));
  if (!photo || image.length > 4_000_000 || !Array.isArray(items))
    return Response.json({ error: "bad request" }, { status: 400 });

  // only fetch product images from Channel3's CDN (never arbitrary URLs)
  const products = await Promise.all(
    items.slice(0, 5).map(async (it: { name: string; url: string }) => {
      const u = new URL(String(it.url));
      if (u.hostname !== "cdn.trychannel3.com") return null;
      const res = await fetch(u);
      if (!res.ok) return null;
      const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/png";
      return { name: String(it.name).slice(0, 40), mime, data: Buffer.from(await res.arrayBuffer()).toString("base64") };
    }),
  );
  const ok = products.filter((p) => p !== null);

  const prompt =
    `Edit the first image (a photo of someone's ${String(canvas).slice(0, 20)}) into a "${String(vibe).slice(0, 60)}" aesthetic ` +
    `by naturally adding these exact products, shown in the following images: ${ok.map((p) => p.name).join(", ")}. ` +
    `Keep the same camera angle, layout and lighting of the original photo so it reads as a before/after. ` +
    `Photorealistic, cozy, no text or labels.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image"}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: photo[1], data: photo[2] } },
              ...ok.map((p) => ({ inline_data: { mime_type: p.mime, data: p.data } })),
            ],
          },
        ],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    },
  );
  const data = await res.json();
  const out = data.candidates?.[0]?.content?.parts?.find((p: { inlineData?: object }) => p.inlineData)?.inlineData;
  if (!res.ok || !out) return Response.json({ error: data.error?.message ?? "no image came back" }, { status: 502 });
  return Response.json({ image: `data:${out.mimeType};base64,${out.data}` });
}
