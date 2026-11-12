import Link from "next/link";

const VIBES = [
  ["🌿", "cottagecore", "#7ee8c7"], ["💿", "y2k", "#8ecbff"], ["🤍", "clean girl", "#fbe3ee"], ["📚", "dark academia", "#ffb38a"],
  ["🐚", "coastal", "#ffe066"], ["💜", "cyber", "#c3a6ff"], ["🎀", "barbiecore", "#ff9fcf"], ["🍵", "japandi", "#d9e8c4"],
  ["🌻", "boho", "#ffcf7a"], ["🐎", "old money", "#cfe3d4"], ["🍓", "kawaii", "#ffc2d1"], ["🎮", "gamer cave", "#9fa8ff"],
];

const SPACES = ["🛋️ room", "👗 outfit", "💻 desk", "🍳 kitchen", "🛁 bathroom", "🎓 dorm", "🪴 balcony", "🎉 party", "🌷 garden", "🧸 nursery", "🚗 car", "🏪 small shop"];

const STEPS = [
  ["📸", "snap", "take a photo of your room, fit, desk… anything. messy is fine.", "#ffe066"],
  ["🎨", "pick a vibe", "12 aesthetics or type your own. set a budget, even a tiny one.", "#c3a6ff"],
  ["🤖", "AI restyles it", "your stylist reads the photo and drops real products from real stores right onto it.", "#7ee8c7"],
  ["💖", "swipe", "keep what you love, skip the rest, or ask for something cheaper or cozier.", "#ff7eb6"],
  ["💳", "pay once", "one PayPal checkout for the whole look, no matter how many stores.", "#ffc439"],
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="lnav">
        <Link className="logo" href="/">vibe <span>check</span></Link>
        <Link className="pill" href="/app">try it free →</Link>
      </nav>

      <header className="hero">
        <div className="hero-copy">
          <p className="badge">✨ AI stylist + PayPal checkout</p>
          <h1>
            turn any space into
            <span className="rotator" aria-label="any vibe">
              <span>cottagecore 🌿</span><span>y2k 💿</span><span>dark academia 📚</span><span>barbiecore 🎀</span><span>any vibe ✨</span>
            </span>
          </h1>
          <p className="lead">
            snap your room, outfit or desk. an AI stylist restyles it with <b>real products from real stores</b>, you swipe what you love,
            and pay for the whole look <b>once, with PayPal</b>.
          </p>
          <div className="ctas">
            <Link className="btn big" href="/app">restyle my space →</Link>
            <a className="btn ghost big" href="#how">how it works ↓</a>
          </div>
          <p className="muted">free · no sign-up · works on your phone</p>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="phone-mini">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=700&q=75" alt="" />
            <span className="tagchip">🌿 cottagecore</span>
            <span className="ps" style={{ left: "18%", top: "30%", animationDelay: ".3s" }}>🪴<i>$24</i></span>
            <span className="ps" style={{ left: "70%", top: "22%", animationDelay: ".6s" }}>🕯️<i>$12</i></span>
            <span className="ps" style={{ left: "30%", top: "66%", animationDelay: ".9s" }}>🧺<i>$29</i></span>
            <span className="ps" style={{ left: "76%", top: "62%", animationDelay: "1.2s" }}>🛏️<i>$45</i></span>
          </div>
          <div className="floater f1">💖 kept!</div>
          <div className="floater f2">💳 paid with PayPal</div>
        </div>
      </header>

      <div className="marquee" aria-label="vibes">
        <div>
          {[...VIBES, ...VIBES].map(([e, n, c], i) => (
            <span key={i} style={{ background: c }}>{e} {n}</span>
          ))}
        </div>
      </div>

      <section id="how" className="lsec">
        <h2>how it works</h2>
        <p className="lead">five taps from &ldquo;my room is boring&rdquo; to &ldquo;my room is iconic&rdquo;</p>
        <div className="howgrid">
          {STEPS.map(([e, t, d, c], i) => (
            <div key={t} className="card howcard" style={{ transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)` }}>
              <span className="num" style={{ background: c }}>{e}</span>
              <h3>{i + 1}. {t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lsec">
        <h2>not just another moodboard</h2>
        <div className="whygrid">
          <div className="card why-c" style={{ background: "#e9fbf4" }}>
            <h3>🛍️ real stuff, really buyable</h3>
            <p>every pick is a live, in-stock product with a real price, from stores like macy&apos;s, lowe&apos;s and etsy. not AI-imagined furniture you can&apos;t find.</p>
          </div>
          <div className="card why-c" style={{ background: "#fff6d6" }}>
            <h3>💳 one checkout, many stores</h3>
            <p>a look usually spans 5 stores = 5 checkouts. here it&apos;s one PayPal payment, with buyer protection on the whole kit.</p>
          </div>
          <div className="card why-c" style={{ background: "#ffe8f1" }}>
            <h3>🤖 an agent that has your back</h3>
            <p>after you pay, your AI agent re-checks stock. if anything sold out, it refunds you through PayPal on the spot, automatically.</p>
          </div>
        </div>
      </section>

      <section className="lsec">
        <h2>restyle anything</h2>
        <div className="spacegrid">
          {SPACES.map((s) => <span key={s} className="chip">{s}</span>)}
        </div>
      </section>

      <section className="lsec final">
        <div className="card finalcard">
          <h2>your space is one vibe check away ✨</h2>
          <p className="lead">no photo? use one of ours. takes about a minute.</p>
          <Link className="btn big" href="/app">start vibing →</Link>
        </div>
      </section>

      <footer className="lfoot">
        built for the PayPal AI Hackathon · AI by Groq · products by Channel3 · payments by PayPal (sandbox)
      </footer>
    </div>
  );
}
