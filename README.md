# vibe check ✨

**Snap your room, outfit or desk → pick a vibe → an AI stylist restyles it with real products → swipe what you love → buy the whole look in one PayPal checkout.**

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). **Live demo: https://vibe-check-tau-three.vercel.app**

## The problem

You see an aesthetic you love on Pinterest and want *your* space to look like that. Getting there means hours of searching across a dozen stores, guessing what fits your room and your budget, and checking out a dozen times. Most people give up at the moodboard.

## What it does

1. **Snap**: upload or take a photo of any of 12 spaces (room, outfit, desk, kitchen, bathroom, dorm, balcony, party, garden, nursery, car, small shop), or use a sample photo.
2. **Pick a vibe**: 12 aesthetics (cottagecore, y2k, clean girl, dark academia, coastal, cyber, barbiecore, japandi, boho, old money, kawaii, gamer cave) or type your own, like "studio ghibli kitchen". Set a budget.
3. **AI restyle**: a vision model looks at *your* photo and plans 5 products that suit what's in it, the vibe and the budget. Each one is matched to a **real, in-stock product** from Channel3's catalog and dropped onto your photo as a cut-out sticker you can drag around.
4. **Chat with your stylist**: "cheaper", "cozier", "swap the rug". The AI re-plans with your previous picks as context.
5. **Swipe**: Tinder-style. Keep 💖, skip ✖️, or 🔄 swap for another real option.
6. **One PayPal checkout**: every item you kept goes into a single itemized PayPal order, with a live budget meter.
7. **What happens next**: after capture, the AI agent re-checks stock for every line. Anything that sold out is **refunded automatically through PayPal's Refunds API**. You then see the real PayPal order and capture IDs, the refund, the orders grouped by store, and the shipping name and city from PayPal.
8. **Share**: a vibe card you can download as a PNG or share.

## How PayPal and AI are used

| | What | How |
|---|---|---|
| 🤖 AI | **Groq**, `qwen/qwen3.8-27b` (vision) | Reads the user's photo and returns a JSON style plan: scene read, stylist note, 5 product search queries with per-item price caps that sum to the budget, and x/y positions where each item belongs in the photo. |
| 🛍️ Products | **Channel3** API | `/v1/search` turns each AI query into real products, filtered by price and availability. `/experimental/sticker` cuts products into transparent stickers. `/v1/products/{id}` re-checks the live price at checkout. |
| 💳 Payments | **PayPal** Orders v2, Payments v2 + JS SDK (sandbox) | The server creates **one order with an itemized line per product**, using the Channel3 product id as the `sku` (`POST /v2/checkout/orders`). It captures after approval (`/capture`), reads the order back (`GET /v2/checkout/orders/{id}`) for the line items and shipping address, and **partially refunds sold-out lines** (`POST /v2/payments/captures/{id}/refund`). The PayPal Smart Buttons run the buyer flow. |

**Agentic commerce:** the AI agent does the shopping (it plans, searches, compares and fits the budget) and the human only approves. PayPal is the single trusted payment step for a cart that spans many stores. Vibe Check acts as the merchant of record and would place the orders with each retailer.

**Security:** prices are never trusted from the browser. The order route re-reads each product's live price from Channel3 before creating the PayPal order, and refund amounts come from PayPal's own record of the order. All API keys stay on the server.

**Demo the auto-refund:** open `/app?soldout=1` and pay as usual. In the sandbox, the last item then "sells out" right after payment, so you can watch the agent refund it through PayPal.

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

- `app/page.tsx`: landing page
- `app/VibeApp.tsx` (served at `/app`): the whole playful UI (step bar, draggable stickers, stylist chat, swipe cards, PayPal buttons, order timeline, share card)
- `lib/services.ts`: Groq, Channel3 and PayPal helpers
- `app/api/style`: photo → AI plan → real products + stickers
- `app/api/sticker`: sticker for a swapped-in product
- `app/api/paypal/order`, `app/api/paypal/capture`: checkout, stock re-check and auto-refund

Sample photos are from [Unsplash](https://unsplash.com).

## License

MIT
