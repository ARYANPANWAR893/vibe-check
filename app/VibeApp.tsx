"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import Link from "next/link";
import type { Item } from "@/lib/services";

type Step = "snap" | "vibe" | "loading" | "restyle" | "swipe" | "bag" | "done";
type Vibe = { name: string; emoji: string; color: string };
type Result = { scene: string; message: string; items: Item[]; alternates: Item[][] };
type Receipt = {
  orderId: string;
  captureId: string;
  paid: number;
  payer: string;
  shipTo: { name: string; city: string } | null;
  items: { id: string; name: string; price: number; available: boolean }[];
  refund: { id: string; status: string; amount: number } | null;
};

const CANVASES = [
  { id: "room", label: "🛋️ room" },
  { id: "outfit", label: "👗 fit" },
  { id: "desk", label: "💻 desk" },
  { id: "kitchen", label: "🍳 kitchen" },
  { id: "bathroom", label: "🛁 bathroom" },
  { id: "dorm", label: "🎓 dorm" },
  { id: "balcony", label: "🪴 balcony" },
  { id: "party", label: "🎉 party" },
  { id: "garden", label: "🌷 garden" },
  { id: "nursery", label: "🧸 nursery" },
  { id: "car", label: "🚗 car" },
  { id: "small shop", label: "🏪 small shop" },
];

const VIBES: Vibe[] = [
  { name: "cottagecore", emoji: "🌿", color: "#7ee8c7" },
  { name: "y2k", emoji: "💿", color: "#8ecbff" },
  { name: "clean girl", emoji: "🤍", color: "#fbe3ee" },
  { name: "dark academia", emoji: "📚", color: "#ffb38a" },
  { name: "coastal", emoji: "🐚", color: "#ffe066" },
  { name: "cyber", emoji: "💜", color: "#c3a6ff" },
  { name: "barbiecore", emoji: "🎀", color: "#ff9fcf" },
  { name: "japandi", emoji: "🍵", color: "#d9e8c4" },
  { name: "boho", emoji: "🌻", color: "#ffcf7a" },
  { name: "old money", emoji: "🐎", color: "#cfe3d4" },
  { name: "kawaii", emoji: "🍓", color: "#ffc2d1" },
  { name: "gamer cave", emoji: "🎮", color: "#9fa8ff" },
];

// Sample photos so anyone (judges included) can try it without their own photo. Unsplash license.
const SAMPLES: Record<string, string> = {
  room: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1024&q=80",
  outfit: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1024&q=80",
  desk: "https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=1024&q=80",
  kitchen: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1024&q=80",
  bathroom: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1024&q=80",
  dorm: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=1024&q=80",
};

const LOADING_LINES = [
  "reading the room 👀",
  "consulting the vibe council 🔮",
  "raiding every store online 🛍️",
  "cutting out stickers ✂️",
  "doing budget math (ugh) 🧮",
];

const REFINES = ["cheaper 💸", "more colorful 🌈", "cozier 🧸", "more minimal 🤍"];

const BUDGET_LABELS: [number, string][] = [
  [60, "broke student 🥲"],
  [150, "a little treat 🍰"],
  [300, "main character 💅"],
  [Infinity, "treat yourself 💸"],
];

const STEPS = ["snap", "vibe", "pick", "pay"];
const STEP_INDEX: Record<Step, number> = { snap: 0, vibe: 1, loading: 1, restyle: 2, swipe: 2, bag: 3, done: 4 };

const money = (n: number) => `$${n.toFixed(n % 1 ? 2 : 0)}`;

/** Downscales any photo to a <=1024px JPEG data URL (keeps the AI request small and fast). */
async function toDataUrl(src: string | File): Promise<string> {
  const img = await loadImage(typeof src === "string" ? src : URL.createObjectURL(src));
  const s = Math.min(1, 1024 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

async function loadImage(src: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  return img;
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: object) => { render: (el: HTMLElement) => Promise<void>; close?: () => void };
    };
  }
}

let paypalLoading: Promise<void> | null = null; // load the SDK once; a second copy kills the first's buttons
function loadPaypal(clientId: string) {
  return (paypalLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("couldn't load PayPal"));
    document.body.appendChild(s);
  }));
}

export default function VibeApp({ paypalClientId }: { paypalClientId: string }) {
  const [step, setStep] = useState<Step>("snap");
  const [canvas, setCanvas] = useState("room");
  const [photo, setPhoto] = useState("");
  const [vibe, setVibe] = useState<Vibe>(VIBES[0]);
  const [custom, setCustom] = useState("");
  const [budget, setBudget] = useState(150);
  const [result, setResult] = useState<Result | null>(null);
  const [idx, setIdx] = useState(0);
  const [kept, setKept] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [line, setLine] = useState(0);
  const [ask, setAsk] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const vibeName = custom.trim() || vibe.name;
  const vibeEmoji = custom.trim() ? "✨" : vibe.emoji;
  const accent = custom.trim() ? "#ff7eb6" : vibe.color;
  const total = kept.reduce((s, i) => s + i.price, 0);

  function reset() {
    setStep("snap");
    setPhoto("");
    setResult(null);
    setKept([]);
    setIdx(0);
    setError("");
    setReceipt(null);
  }

  async function pickPhoto(src: string | File) {
    setError("");
    try {
      setPhoto(await toDataUrl(src));
    } catch {
      setError("couldn't open that photo, try a jpg or png 🙏");
    }
  }

  async function restyle(feedback = "") {
    const back = step;
    setStep("loading");
    setError("");
    try {
      const res = await fetch("/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: photo,
          canvas,
          vibe: vibeName,
          budget,
          feedback,
          previous: result?.items.map((i) => `${i.name} ($${i.price})`).join(", "),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setKept([]);
      setIdx(0);
      setAsk("");
      setStep("restyle");
    } catch (e) {
      setError((e as Error).message || "the stylist tripped, try again");
      setStep(back === "restyle" ? "restyle" : "vibe");
    }
  }

  // rotate the fun loading lines
  useEffect(() => {
    if (step !== "loading") return;
    const t = setInterval(() => setLine((l) => (l + 1) % LOADING_LINES.length), 1400);
    return () => clearInterval(t);
  }, [step]);

  function moveSticker(i: number, x: number, y: number) {
    setResult((r) => r && { ...r, items: r.items.map((it, j) => (j === i ? { ...it, x, y } : it)) });
  }

  function decide(keep: boolean) {
    if (!result) return;
    const next = keep ? [...kept, result.items[idx]] : kept;
    setKept(next);
    setError("");
    if (idx + 1 < result.items.length) setIdx(idx + 1);
    else setStep("bag");
  }

  async function swap() {
    if (!result) return;
    const alts = result.alternates[idx];
    if (!alts?.length) {
      setError("no more options for this one, keep or skip it 🙈");
      return;
    }
    setError("");
    const [next, ...rest] = alts;
    const cur = result.items[idx];
    const swapped = { ...next, x: cur.x, y: cur.y };
    setResult({
      ...result,
      items: result.items.map((it, j) => (j === idx ? swapped : it)),
      alternates: result.alternates.map((a, j) => (j === idx ? [...rest, cur] : a)),
    });
    // upgrade the swapped-in product to a cut-out sticker in the background
    const { sticker } = await fetch(`/api/sticker?id=${encodeURIComponent(next.id)}`).then((r) => r.json());
    if (sticker)
      setResult((r) => r && { ...r, items: r.items.map((it) => (it.id === next.id ? { ...it, sticker } : it)) });
  }

  return (
    <main className="app" style={{ "--vibe": accent } as CSSProperties}>
      <div className="top">
        <Link className="logo" href="/" aria-label="vibe check home">
          vibe <span>check</span>
        </Link>
        <button className="step" onClick={reset}>start over ↺</button>
      </div>
      <Stepper at={STEP_INDEX[step]} />

      {error && step !== "swipe" && <p className="err" role="alert">{error}</p>}

      {step === "snap" && (
        <section className="screen">
          <div>
            <h2>what are we<br />restyling? ✨</h2>
            <p className="hint">pick a space, then snap or upload a photo of it</p>
          </div>
          <div className="chips" role="radiogroup" aria-label="what are you restyling">
            {CANVASES.map((c) => (
              <button key={c.id} role="radio" aria-checked={canvas === c.id} className={`chip ${canvas === c.id ? "on" : ""}`} onClick={() => setCanvas(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <label className="drop">
            {photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="your photo" />
                <span className="retake">change photo 📸</span>
              </>
            ) : (
              <div>
                <div className="cam">📸</div>
                <b className="display" style={{ fontSize: 19 }}>tap to snap or upload</b>
                <p className="muted">a messy {canvas} is totally fine lol</p>
              </div>
            )}
            <input className="sr" type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && pickPhoto(e.target.files[0])} />
          </label>
          {!photo && SAMPLES[canvas] && (
            <div className="samples">
              <span className="muted">no photo handy?</span>
              <button onClick={() => pickPhoto(SAMPLES[canvas])}>use a sample {canvas}</button>
            </div>
          )}
          <button className="btn" disabled={!photo} onClick={() => setStep("vibe")}>
            {photo ? "next: pick a vibe →" : "add a photo first 👆"}
          </button>
        </section>
      )}

      {step === "vibe" && (
        <section className="screen">
          <div>
            <h2>what&apos;s the vibe?</h2>
            <p className="hint">tap an aesthetic (or type any vibe you can dream up) and set your budget</p>
          </div>
          <div className="vibes" role="radiogroup" aria-label="pick a vibe">
            {VIBES.map((v) => (
              <button
                key={v.name}
                role="radio"
                aria-checked={!custom && vibe.name === v.name}
                className={`vibe ${!custom && vibe.name === v.name ? "sel" : ""}`}
                style={{ background: v.color }}
                onClick={() => { setVibe(v); setCustom(""); }}
              >
                <i>{v.emoji}</i>
                <b>{v.name}</b>
              </button>
            ))}
          </div>
          <input className="custom" placeholder="or type your own… “studio ghibli kitchen” 🍃" aria-label="custom vibe" value={custom} maxLength={60} onChange={(e) => setCustom(e.target.value)} />
          <div className="card slider">
            <label className="display" htmlFor="budget" style={{ fontWeight: 600 }}>
              total budget: {money(budget)} · {BUDGET_LABELS.find(([max]) => budget <= max)![1]}
            </label>
            <input id="budget" type="range" min={30} max={500} step={10} value={budget} onChange={(e) => setBudget(+e.target.value)} />
            <div className="ends"><span>$30</span><span>drag to set</span><span>$500</span></div>
          </div>
          <button className="btn" onClick={() => restyle()}>restyle my {canvas} {vibeEmoji}</button>
        </section>
      )}

      {step === "loading" && (
        <section className="screen loading" aria-live="polite">
          <div className="blob">{vibeEmoji}</div>
          <h2 style={{ fontSize: 26 }}>{LOADING_LINES[line]}</h2>
          <p className="muted">your AI stylist is shopping real stores for a {vibeName} {canvas}. ~10 seconds</p>
        </section>
      )}

      {step === "restyle" && result && (
        <section className="screen">
          <div>
            <h2 style={{ fontSize: 26 }}>your {vibeName} {canvas} {vibeEmoji}</h2>
            <p className="hint">every sticker is a real product from a real store. drag them around!</p>
          </div>
          <Scene photo={photo} items={result.items} tag={`${vibeEmoji} ${vibeName}`} onMove={moveSticker} />
          <div className="card ai">
            <div className="av">🤖</div>
            <p>
              <b>your stylist:</b> {result.message} <b>{result.items.length} picks, {money(result.items.reduce((s, i) => s + i.price, 0))}</b>
            </p>
          </div>
          <form className="askbar card" onSubmit={(e) => { e.preventDefault(); if (ask.trim()) restyle(ask.trim()); }}>
            <label className="display" htmlFor="ask">not quite it? tell your stylist</label>
            <div className="refines">
              {REFINES.map((r) => (
                <button type="button" key={r} onClick={() => restyle(r)}>{r}</button>
              ))}
            </div>
            <div className="askrow">
              <input id="ask" value={ask} maxLength={200} placeholder="e.g. swap the rug, more pink…" onChange={(e) => setAsk(e.target.value)} />
              <button type="submit" aria-label="send to stylist" disabled={!ask.trim()}>➤</button>
            </div>
          </form>
          <button className="btn" onClick={() => setStep("swipe")}>love it → choose what to buy</button>
        </section>
      )}

      {step === "swipe" && result && (
        <section className="screen">
          <div>
            <h2 style={{ fontSize: 26 }}>keep or skip?</h2>
            <p className="hint">item {idx + 1} of {result.items.length} · {kept.length} in your bag · {money(total)}</p>
          </div>
          <SwipeCard key={result.items[idx].id} item={result.items[idx]} coach={idx === 0} onDecide={decide} />
          {error && <p className="err" role="alert">{error}</p>}
          <div className="acts">
            <button className="act" onClick={() => decide(false)}><span className="round">✖️</span>skip</button>
            <button className="act" onClick={swap}><span className="round" style={{ background: "var(--lemon)" }}>🔄</span>show another</button>
            <button className="act" onClick={() => decide(true)}><span className="round" style={{ background: "var(--pink)" }}>💖</span>keep</button>
          </div>
        </section>
      )}

      {step === "bag" && (
        <Bag
          items={kept}
          vibeName={vibeName}
          budget={budget}
          paypalClientId={paypalClientId}
          onRemove={(id) => setKept(kept.filter((k) => k.id !== id))}
          onRestart={() => { setIdx(0); setKept([]); setStep("swipe"); }}
          onPaid={(r) => { setReceipt(r); setStep("done"); }}
        />
      )}

      {step === "done" && receipt && (
        <section className="screen">
          <Confetti />
          <div>
            <h2>vibe secured! 🎉</h2>
            <p className="hint">here&apos;s what your AI shopping agent is doing now</p>
          </div>
          <OrderTimeline receipt={receipt} kept={kept} />
          <ShareCard photo={photo} kept={kept} canvas={canvas} vibeName={vibeName} vibeEmoji={vibeEmoji} accent={accent} total={receipt.paid - (receipt.refund?.amount ?? 0)} />
          <button className="btn ghost" onClick={reset}>restyle something else ↺</button>
        </section>
      )}
    </main>
  );
}

/** snap · vibe · pick · pay progress bar so people always know where they are. */
function Stepper({ at }: { at: number }) {
  return (
    <ol className="stepper" aria-label="progress">
      {STEPS.map((s, i) => (
        <li key={s} className={i < at ? "done" : i === at ? "now" : ""} aria-current={i === at ? "step" : undefined}>
          <span>{i < at ? "✓" : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** Your photo with draggable product stickers on top. */
function Scene({ photo, items, tag, onMove }: { photo: string; items: Item[]; tag: string; onMove: (i: number, x: number, y: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = (i: number) => (e: RPointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const clamp = (v: number) => Math.min(95, Math.max(5, v));
    onMove(i, clamp(((e.clientX - r.left) / r.width) * 100), clamp(((e.clientY - r.top) / r.height) * 100));
  };
  return (
    <div className="scene" ref={ref}>
      <div className="tag">{tag}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="your photo" />
      {items.map((it, i) => (
        <div
          key={it.id}
          className="stk"
          title={`${it.title} · ${money(it.price)} at ${it.store}`}
          style={{ left: `${it.x}%`, top: `${it.y}%`, animationDelay: `${0.15 + i * 0.18}s` }}
          onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={drag(i)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.sticker} alt={it.name} draggable={false} />
          <span>{money(it.price)}</span>
        </div>
      ))}
    </div>
  );
}

/** Tinder-style card: drag right to keep, left to skip. */
function SwipeCard({ item, coach, onDecide }: { item: Item; coach: boolean; onDecide: (keep: boolean) => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const end = () => {
    if (Math.abs(dx) > 90) onDecide(dx > 0);
    else setDx(0);
    start.current = null;
  };
  return (
    <div className="stack">
      <div className="card swipe back1" />
      <div className="card swipe back2" />
      <div
        className="card swipe front"
        style={{ transform: `translateX(${dx}px) rotate(${dx / 14}deg)`, transition: start.current === null ? "transform .25s" : "none" }}
        onPointerDown={(e) => { start.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => start.current !== null && setDx(e.clientX - start.current)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {coach && dx === 0 && <div className="coach">👈 skip · drag me · keep 👉</div>}
        {dx > 40 && <div className="stamp" style={{ left: 22, transform: "rotate(-12deg)", background: "var(--pink)" }}>KEEP 💖</div>}
        {dx < -40 && <div className="stamp" style={{ right: 22, transform: "rotate(12deg)" }}>NOPE ✖️</div>}
        <div className="pic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.sticker || item.image} alt={item.title} draggable={false} />
        </div>
        <div className="price">
          <div>
            <span className="t">{item.name}</span>
            <p className="muted">{item.title.slice(0, 60)} · <b>{item.store}</b></p>
          </div>
          <b className="amt">{money(item.price)}</b>
        </div>
        <div className="why">✨ why: {item.why}</div>
      </div>
    </div>
  );
}

function Bag({
  items, vibeName, budget, paypalClientId, onRemove, onRestart, onPaid,
}: {
  items: Item[]; vibeName: string; budget: number; paypalClientId: string;
  onRemove: (id: string) => void; onRestart: () => void; onPaid: (r: Receipt) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const ids = useRef<string[]>([]);
  ids.current = items.map((i) => i.id);
  const [error, setError] = useState("");
  const total = items.reduce((s, i) => s + i.price, 0);
  const left = budget - total;
  const stores = new Set(items.map((i) => i.store)).size;
  const hasItems = items.length > 0;

  useEffect(() => {
    if (!hasItems || !paypalClientId) return;
    let cancelled = false;
    // ?soldout=1 makes the last item "sell out" after payment so the auto-refund can be demoed (sandbox only)
    const simulateSoldOut = new URLSearchParams(location.search).has("soldout");
    loadPaypal(paypalClientId)
      .then(() => {
        if (cancelled || !box.current || !window.paypal) return;
        box.current.innerHTML = "";
        window.paypal
          .Buttons({
            style: { shape: "pill", color: "gold", label: "pay", height: 52 },
            createOrder: async () => {
              setError("");
              const res = await fetch("/api/paypal/order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: ids.current, vibe: vibeName }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              return data.id;
            },
            onApprove: async ({ orderID }: { orderID: string }) => {
              const res = await fetch("/api/paypal/capture", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderID, simulateSoldOut }),
              });
              const data = await res.json();
              if (!res.ok) return setError(data.error ?? "payment didn't go through");
              onPaid(data);
            },
            onError: (e: Error) => setError(e.message || "PayPal hiccup, try again"),
          })
          .render(box.current);
      })
      .catch((e) => setError(e.message));
    return () => { cancelled = true; };
    // render the buttons once per bag visit; createOrder reads the latest ids from the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasItems, paypalClientId]);

  if (!hasItems)
    return (
      <section className="screen">
        <h2>your bag is empty 🥲</h2>
        <p className="hint">you skipped everything! picky icon behavior.</p>
        <button className="btn" onClick={onRestart}>swipe again</button>
      </section>
    );

  return (
    <section className="screen">
      <div>
        <h2>your {vibeName} kit</h2>
        <p className="hint">{items.length} items from {stores} {stores === 1 ? "store" : "stores"}, one payment. tap ✖️ to remove anything</p>
      </div>
      <div className="card">
        {items.map((it) => (
          <div className="row" key={it.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.sticker || it.image} alt="" />
            <span>{it.name}<small>{it.store}</small></span>
            <b>{money(it.price)}</b>
            <button aria-label={`remove ${it.name}`} onClick={() => onRemove(it.id)}>✖️</button>
          </div>
        ))}
        <div className="total"><span>total</span><span>{money(total)}</span></div>
      </div>
      <div>
        <div className="meter"><div className={left < 0 ? "over" : ""} style={{ width: `${Math.min(100, (total / budget) * 100)}%` }} /></div>
        <p className="muted" style={{ marginTop: 6 }}>{left >= 0 ? `${money(left)} left in budget 🎉` : `${money(-left)} over budget 👀`}</p>
      </div>
      <ol className="how">
        <li><b>1.</b> you pay once with PayPal (buyer protection on the whole kit)</li>
        <li><b>2.</b> your AI agent re-checks stock and orders from each store</li>
        <li><b>3.</b> anything that sold out? auto-refunded to your PayPal</li>
      </ol>
      {error && <p className="err" role="alert">{error}</p>}
      {paypalClientId ? <div className="paypal-box" ref={box} /> : <p className="err">add PAYPAL_CLIENT_ID to .env.local to enable checkout</p>}
    </section>
  );
}

/** What happens after paying: real PayPal capture, stock re-check, auto-refund, per-store orders. */
function OrderTimeline({ receipt, kept }: { receipt: Receipt; kept: Item[] }) {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setShown((s) => Math.min(s + 1, 4)), 900);
    return () => clearInterval(t);
  }, []);
  const gone = receipt.items.filter((i) => !i.available);
  const byStore = new Map<string, Item[]>();
  for (const it of kept) if (!gone.some((g) => g.id === it.id)) byStore.set(it.store, [...(byStore.get(it.store) ?? []), it]);

  const steps = [
    <><b>paid {money(receipt.paid)} with PayPal</b><small>order {receipt.orderId} · capture {receipt.captureId}</small></>,
    gone.length ? (
      <><b>{gone.length} item sold out → refunded {money(receipt.refund?.amount ?? 0)} to your PayPal</b><small>{gone.map((g) => g.name).join(", ")} · refund {receipt.refund?.id} ({receipt.refund?.status?.toLowerCase()})</small></>
    ) : (
      <><b>agent re-checked stock: all {receipt.items.length} items available</b><small>nothing to refund ✨</small></>
    ),
    <><b>orders queued with {byStore.size} {byStore.size === 1 ? "store" : "stores"}</b>
      <small>{[...byStore].map(([store, its]) => `${store} (${its.length})`).join(" · ")}</small></>,
    <><b>shipping to {receipt.shipTo?.name || receipt.payer || "you"}</b><small>{receipt.shipTo?.city || "address from your PayPal account"}</small></>,
  ];
  const icons = ["💳", gone.length ? "↩️" : "🔍", "📦", "🚚"];

  return (
    <ol className="card timeline" aria-live="polite">
      {steps.slice(0, shown).map((s, i) => (
        <li key={i} className={i === 1 && gone.length ? "warn" : ""}>
          <span className="dot">{icons[i]}</span>
          <div>{s}</div>
        </li>
      ))}
    </ol>
  );
}

/** Before/after card you can download as a PNG or share. */
function ShareCard({ photo, kept, canvas, vibeName, vibeEmoji, accent, total }: {
  photo: string; kept: Item[]; canvas: string; vibeName: string; vibeEmoji: string; accent: string; total: number;
}) {
  const caption = `my ${canvas} went ${vibeName} for ${money(total)} ${vibeEmoji}`;

  async function download() {
    await document.fonts.ready;
    const W = 1080, H = 1350, pad = 60;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = accent;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#1b1235";
    g.font = "700 64px Fredoka, sans-serif";
    g.fillText(`my ${canvas} went`, pad, 130);
    g.fillText(`${vibeName} ${vibeEmoji}`, pad, 210);
    // photo, cover-cropped into a 960x900 frame, with the kept stickers on top
    const img = await loadImage(photo);
    const fw = W - pad * 2, fh = 900, fx = pad, fy = 260;
    const s = Math.max(fw / img.width, fh / img.height);
    g.save();
    g.beginPath();
    g.roundRect(fx, fy, fw, fh, 36);
    g.clip();
    g.drawImage(img, fx + (fw - img.width * s) / 2, fy + (fh - img.height * s) / 2, img.width * s, img.height * s);
    for (const it of kept) {
      const st = await loadImage(it.sticker).catch(() => null);
      if (!st) continue;
      const w = fw * 0.24, h = (w * st.height) / st.width;
      g.drawImage(st, fx + (fw * it.x) / 100 - w / 2, fy + (fh * it.y) / 100 - h / 2, w, h);
    }
    g.restore();
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(fx, fy, fw, fh, 36);
    g.stroke();
    g.font = "600 44px Fredoka, sans-serif";
    g.fillText(`${kept.length} items · ${money(total)} · vibe check ✨`, pad, H - 80);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `vibe-check-${vibeName.replace(/\W+/g, "-")}.png`;
    a.click();
  }

  return (
    <>
      <div className="card share">
        <b className="display" style={{ fontSize: 23 }}>my {canvas} went<br />{vibeName} {vibeEmoji}</b>
        <div className="collage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" />
          {kept.map((it) => (
            <div key={it.id} className="stk" style={{ left: `${it.x}%`, top: `${it.y}%`, width: "22%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.sticker} alt={it.name} />
            </div>
          ))}
        </div>
        <p className="display" style={{ fontWeight: 600 }}>{kept.length} items · {money(total)} · via vibe check</p>
      </div>
      <div className="twobtn">
        <button className="btn lemon" onClick={download}>save card ⬇️</button>
        <button
          className="btn"
          onClick={() => {
            if (navigator.share) navigator.share({ text: caption, url: location.origin }).catch(() => {});
            else navigator.clipboard.writeText(`${caption} ${location.origin}`).then(() => alert("copied! paste it anywhere 📋"));
          }}
        >
          share 📤
        </button>
      </div>
    </>
  );
}

function Confetti() {
  const colors = ["#ff7eb6", "#ffe066", "#7ee8c7", "#8ecbff", "#c3a6ff", "#ffb38a"];
  return (
    <>
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 8) * 0.15}s` }}
        />
      ))}
    </>
  );
}
