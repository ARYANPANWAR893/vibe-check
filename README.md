# vibe check ✨

**Snap your room, outfit or desk → pick a vibe → an AI stylist restyles it with real products → swipe what you love → buy the whole look in one PayPal checkout.**

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

## The problem

You see an aesthetic you love on Pinterest and want *your* space to look like that. Getting there means hours of searching across a dozen stores, guessing what fits your room and your budget, and checking out a dozen times. Most people give up at the moodboard.

## What it does

1. **Snap**: upload or take a photo of your room, fit or desk (or use a sample photo).
2. **Pick a vibe**: 12 aesthetics (cottagecore, y2k, clean girl, dark academia, coastal, cyber, barbiecore, japandi, boho, old money, kawaii, gamer cave) or type your own, like "studio ghibli kitchen". Set a budget.
3. **AI restyle**: a vision model looks at *your* photo and plans 5 products that suit what's in it, the vibe and the budget. Each one is matched to a **real, in-stock product** from Channel3's catalog and dropped onto your photo as a cut-out sticker you can drag around.
4. **Swipe**: Tinder-style. Keep 💖, skip ✖️, or 🔄 swap for another real option.
5. **One PayPal checkout**: every item you kept goes into a single PayPal order, with a live budget meter.
6. **Share**: a before/after vibe card with confetti.

## How PayPal and AI are used

| | What | How |
|---|---|---|
| 🤖 AI | **Groq**, `qwen/qwen3.8-27b` (vision) | Reads the user's photo and returns a JSON style plan: scene read, stylist note, 5 product search queries with per-item price caps that sum to the budget, and x/y positions where each item belongs in the photo. |
| 🛍️ Products | **Channel3** API | `/v1/search` turns each AI query into real products, filtered by price and availability. `/experimental/sticker` cuts products into transparent stickers. `/v1/products/{id}` re-checks the live price at checkout. |
| 💳 Payments | **PayPal** Orders v2 + JS SDK (sandbox) | The server creates **one order with an itemized line for every product** (`/v2/checkout/orders`) and captures it after approval (`/v2/checkout/orders/{id}/capture`). The PayPal Smart Buttons run the buyer flow. |

**Agentic commerce:** the AI agent does the shopping (it plans, searches, compares and fits the budget) and the human only approves. PayPal is the single trusted payment step for a cart that spans many stores. Vibe Check acts as the merchant of record and would place the orders with each retailer.

**Security:** prices are never trusted from the browser. The order route re-reads each product's live price from Channel3 before creating the PayPal order. All API keys stay on the server.

## Run it locally

Requires Node 20+.

```bash
git clone https://github.com/ARYANPANWAR893/vibe-check.git
cd vibe-check
npm install
cp .env.example .env.local   # then fill in the 4 keys below
npm run dev                  # http://localhost:3000
```

| Key | Where to get it (all free) |
|---|---|
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| `CHANNEL3_API_KEY` | [trychannel3.com](https://trychannel3.com/sign-up/developer) (1,000 free searches/month) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → **Sandbox** |

To pay in the demo, log into the PayPal popup with your **sandbox Personal account**: developer.paypal.com → Testing Tools → Sandbox Accounts. It's test money.

## Tech

Next.js 15 (App Router) and React 19 with plain CSS, no UI library. Everything lives in a few files:

- `app/VibeApp.tsx`: the whole playful UI (screens, draggable stickers, swipe cards, PayPal buttons)
- `lib/services.ts`: Groq, Channel3 and PayPal helpers
- `app/api/style`: photo → AI plan → real products + stickers
- `app/api/sticker`: sticker for a swapped-in product
- `app/api/paypal/order`, `app/api/paypal/capture`: checkout

Sample photos are from [Unsplash](https://unsplash.com).

## License

MIT
