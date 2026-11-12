"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import type { Item } from "@/lib/services";

type Step = "snap" | "vibe" | "loading" | "restyle" | "swipe" | "bag" | "done";
type Vibe = { name: string; emoji: string; color: string };
type Result = { scene: string; message: string; items: Item[]; alternates: Item[][] };

const CANVASES = [
  { id: "room", label: "🛋️ room" },
  { id: "outfit", label: "👗 fit" },
  { id: "desk", label: "💻 desk" },
];

const VIBES: Vibe[] = [
  { name: "cottagecore", emoji: "🌿", color: "#7ee8c7" },
  { name: "y2k", emoji: "💿", color: "#8ecbff" },
  { name: "clean girl", emoji: "🤍", color: "#fbe3ee" },
  { name: "dark academia", emoji: "📚", color: "#ffb38a" },
  { name: "coastal", emoji: "🐚", color: "#ffe066" },
  { name: "cyber", emoji: "💜", color: "#c3a6ff" },
];

// Sample photos so anyone (judges included) can try it without their own photo. Unsplash license.
const SAMPLES: Record<string, string> = {
  room: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1024&q=80",
  outfit: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1024&q=80",
  desk: "https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=1024&q=80",
};

const LOADING_LINES = [
  "reading the room 👀",
  "consulting the vibe council 🔮",
  "raiding every store online 🛍️",
  "cutting out stickers ✂️",
  "doing budget math (ugh) 🧮",
];

const BUDGET_LABELS: [number, string][] = [
  [60, "broke student 🥲"],
  [150, "a little treat 🍰"],
  [300, "main character 💅"],
  [Infinity, "treat yourself 💸"],
];

const money = (n: number) => `$${n.toFixed(n % 1 ? 2 : 0)}`;

/** Downscales any photo to a <=1024px JPEG data URL (keeps the AI request small and fast). */
async function toDataUrl(src: string | File): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = typeof src === "string" ? src : URL.createObjectURL(src);
  await img.decode();
  const s = Math.min(1, 1024 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
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
  const [paidBy, setPaidBy] = useState("");

  const vibeName = custom.trim() || vibe.name;
  const accent = custom.trim() ? "#ff7eb6" : vibe.color;
  const total = kept.reduce((s, i) => s + i.price, 0);

  function reset() {
    setStep("snap");
    setPhoto("");
    setResult(null);
    setKept([]);
    setIdx(0);
    setError("");
  }

  async function pickPhoto(src: string | File) {
    setError("");
    try {
      setPhoto(await toDataUrl(src));
    } catch {
      setError("couldn't open that photo, try a jpg or png 🙏");
    }
  }

  async function restyle() {
    setStep("loading");
    setError("");
    try {
      const res = await fetch("/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photo, canvas, vibe: vibeName, budget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setKept([]);
      setIdx(0);
      setStep("restyle");
    } catch (e) {
      setError((e as Error).message || "the stylist tripped, try again");
      setStep("vibe");
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
        <button className="logo" onClick={reset} aria-label="vibe check, start over">
          vibe <span>check</span>
        </button>
        <div className="step">{STEP_LABEL[step]}</div>
      </div>

      {error && step !== "swipe" && <p className="err" role="alert">{error}</p>}

      {step === "snap" && (
        <section className="screen">
          <h2>show us your<br />space ✨</h2>
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
                <span className="retake">retake 📸</span>
              </>
            ) : (
              <div>
                <div className="cam">📸</div>
                <b className="display" style={{ fontSize: 19 }}>snap or upload</b>
                <p className="muted">a messy {canvas} is totally fine lol</p>
              </div>
            )}
            <input className="sr" type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && pickPhoto(e.target.files[0])} />
          </label>
          {!photo && (
            <div className="samples">
              <span className="muted">no photo handy?</span>
              <button onClick={() => pickPhoto(SAMPLES[canvas])}>use a sample {canvas}</button>
            </div>
          )}
          <button className="btn" disabled={!photo} onClick={() => setStep("vibe")}>next →</button>
        </section>
      )}

      {step === "vibe" && (
        <section className="screen">
          <h2>what&apos;s the vibe?</h2>
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
              budget: {money(budget)} · {BUDGET_LABELS.find(([max]) => budget <= max)![1]}
            </label>
            <input id="budget" type="range" min={30} max={500} step={10} value={budget} onChange={(e) => setBudget(+e.target.value)} />
            <div className="ends"><span>$30</span><span>$500</span></div>
          </div>
          <button className="btn" onClick={restyle}>vibe it up ✨</button>
        </section>
      )}

      {step === "loading" && (
        <section className="screen loading" aria-live="polite">
          <div className="blob">{custom ? "✨" : vibe.emoji}</div>
          <h2 style={{ fontSize: 26 }}>{LOADING_LINES[line]}</h2>
          <p className="muted">your AI stylist is shopping for a {vibeName} {canvas}</p>
        </section>
      )}

      {step === "restyle" && result && (
        <section className="screen">
          <Scene photo={photo} items={result.items} tag={`${custom ? "✨" : vibe.emoji} ${vibeName}`} onMove={moveSticker} />
          <p className="muted center">psst, drag the stickers around 👆</p>
          <div className="card ai">
            <div className="av">🤖</div>
            <p>
              <b>your stylist:</b> {result.message} <b>{result.items.length} picks, {money(result.items.reduce((s, i) => s + i.price, 0))}</b>
            </p>
          </div>
          <button className="btn" onClick={() => setStep("swipe")}>swipe the picks →</button>
        </section>
      )}

      {step === "swipe" && result && (
        <section className="screen">
          <p className="muted center">{idx + 1} of {result.items.length} · kept {kept.length} · {money(total)}</p>
          <SwipeCard key={result.items[idx].id} item={result.items[idx]} onDecide={decide} />
          {error && <p className="err" role="alert">{error}</p>}
          <div className="acts">
            <button className="round" aria-label="skip" onClick={() => decide(false)}>✖️</button>
            <button className="round" aria-label="swap for another option" style={{ background: "var(--lemon)" }} onClick={swap}>🔄</button>
            <button className="round" aria-label="keep" style={{ background: "var(--pink)" }} onClick={() => decide(true)}>💖</button>
          </div>
          <p className="muted center">swipe or tap · ✖️ skip · 🔄 swap · 💖 keep</p>
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
          onPaid={(name) => { setPaidBy(name); setStep("done"); }}
        />
      )}

      {step === "done" && (
        <section className="screen">
          <Confetti />
          <h2>vibe secured! 🎉</h2>
          {paidBy && <p className="muted">thanks {paidBy}! paid with PayPal, your stylist is placing the orders now 🤖</p>}
          <div className="card share">
            <b className="display" style={{ fontSize: 23 }}>my {canvas} went<br />{vibeName} {custom ? "✨" : vibe.emoji}</b>
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
          <button
            className="btn lemon"
            onClick={() => {
              const text = `my ${canvas} went ${vibeName} for ${money(total)} ✨ via vibe check`;
              if (navigator.share) navigator.share({ text, url: location.href }).catch(() => {});
              else navigator.clipboard.writeText(`${text} ${location.href}`).then(() => alert("copied! paste it anywhere 📋"));
            }}
          >
            share my vibe 📤
          </button>
          <button className="btn ghost" onClick={reset}>vibe check something else</button>
        </section>
      )}
    </main>
  );
}

const STEP_LABEL: Record<Step, string> = {
  snap: "1 / 4",
  vibe: "2 / 4",
  loading: "✨ styling",
  restyle: "3 / 4",
  swipe: "4 / 4",
  bag: "bag 🛍️",
  done: "done 🎉",
};

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
function SwipeCard({ item, onDecide }: { item: Item; onDecide: (keep: boolean) => void }) {
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
        {dx > 40 && <div className="stamp" style={{ left: 22, transform: "rotate(-12deg)", background: "var(--pink)" }}>KEEP 💖</div>}
        {dx < -40 && <div className="stamp" style={{ right: 22, transform: "rotate(12deg)" }}>NOPE ✖️</div>}
        <div className="pic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.sticker || item.image} alt={item.title} draggable={false} />
        </div>
        <div className="price">
          <div>
            <span className="t">{item.name}</span>
            <p className="muted">{item.title.slice(0, 60)} · {item.store}</p>
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
  onRemove: (id: string) => void; onRestart: () => void; onPaid: (name: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const ids = useRef<string[]>([]);
  ids.current = items.map((i) => i.id);
  const [error, setError] = useState("");
  const total = items.reduce((s, i) => s + i.price, 0);
  const left = budget - total;
  const hasItems = items.length > 0;

  useEffect(() => {
    if (!hasItems || !paypalClientId) return;
    let cancelled = false;
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
                body: JSON.stringify({ orderID }),
              });
              const data = await res.json();
              if (!res.ok || data.status !== "COMPLETED") return setError(data.error ?? "payment didn't go through");
              onPaid(data.payer ?? "");
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
        <p className="muted">you skipped everything! picky icon behavior.</p>
        <button className="btn" onClick={onRestart}>swipe again</button>
      </section>
    );

  return (
    <section className="screen">
      <h2>your {vibeName} kit</h2>
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
      {error && <p className="err" role="alert">{error}</p>}
      {paypalClientId ? <div className="paypal-box" ref={box} /> : <p className="err">add PAYPAL_CLIENT_ID to .env.local to enable checkout</p>}
      <p className="muted center" style={{ fontSize: 12 }}>one PayPal payment for every item. your AI stylist places the orders 🤖</p>
    </section>
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
