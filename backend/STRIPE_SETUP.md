# Real payments with Stripe Connect (optional)

The app ships with **test payments** (simulated tips/subscriptions credited
in-app). To take **real** money and pay creators out, connect Stripe. Until you
set `STRIPE_SECRET_KEY`, everything stays in test mode — nothing breaks.

How it works:
- Creators tap **Set up payouts** in their Wallet → a Stripe Connect **Express**
  account + hosted onboarding (they choose their bank/card). Their account id is
  saved on their user record.
- Buyers pay via **Stripe Checkout**; the charge is a *destination charge* to the
  creator's connected account, with an optional platform fee.
- A **webhook** credits the creator's in-app wallet on success, so the Wallet UI
  matches what you already see in test mode.

## 1. Stripe dashboard
1. Create a Stripe account → enable **Connect** (Settings → Connect).
2. Grab your **Secret key** (`sk_live_…` or `sk_test_…` for testing).
3. Add a webhook endpoint pointing at:
   `https://nampo-backend.onrender.com/api/payments/webhook`
   subscribe to **`checkout.session.completed`**, and copy its **signing secret**
   (`whsec_…`).

## 2. Environment variables (Render → nampo-backend)
| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `PLATFORM_FEE_PERCENT` | your cut, e.g. `0` or `10` |
| `WEB_APP_URL` | `https://nampo-web.onrender.com` (return URLs) |

Redeploy the backend (it auto-deploys on push; env changes need a redeploy).

## 3. Endpoints
- `GET  /api/payments/config` — `{ enabled }`
- `POST /api/payments/payouts/setup` — returns a hosted onboarding `url`
- `GET  /api/payments/payouts/status` — `{ connected, payouts_enabled, … }`
- `POST /api/payments/checkout` — `{ kind: "tip"|"subscription", creator_id, amount }` → hosted checkout `url`
- `POST /api/payments/webhook` — Stripe → credits the creator's wallet

## What's wired to Stripe
- **Subscriptions** — true auto-renewing monthly subscriptions (`mode="subscription"`,
  destination charge to the creator + `PLATFORM_FEE_PERCENT`).
- **Tips** (creator profile) — one-time destination charge to the creator.
- **Advertise / promote** — one-time charge to the platform; the webhook promotes
  the post on success.
- Each flow **falls back to the test sheet** when Stripe is off or the creator
  hasn't set up payouts.
- **DM tips** stay on the test flow for now (they post an inline chat receipt that
  the webhook can't recreate yet) — easy to wire later.

## Testing checklist (Stripe test mode)
Use **test-mode** keys (`sk_test_…`, `whsec_…` from a test webhook). Stripe test cards:
- ✅ Success: `4242 4242 4242 4242` · any future expiry · any CVC · any ZIP
- 🔐 3-D Secure: `4000 0025 0000 3155`
- ❌ Declined: `4000 0000 0000 0002`
- Connect onboarding (test): use SSN `000-00-0000`, routing `110000000`, account `000123456789`, any other fields.

Run through:
1. **Payouts** — log in as the creator → Wallet → *Set up payouts* → finish Stripe onboarding → status flips to **Payouts active**.
2. **Subscribe** — as a different user, open the creator's profile → *Subscribe* → you're sent to Stripe Checkout (recurring) → pay with `4242…` → creator's Wallet shows a subscription earning; Stripe dashboard shows an active subscription.
3. **Tip (profile)** — *Tip* → enter amount → Stripe Checkout → pay → creator's Wallet shows the tip.
4. **Tip (DM)** — in a chat → ➕ *Send tip* → pay → the inline 💸 tip receipt appears in the thread (posted by the webhook) and the recipient's Wallet updates.
5. **Advertise** — Advertise → pick a post + duration → pay → the post shows **Sponsored** after the webhook confirms.
6. **Fallback** — temporarily unset `STRIPE_SECRET_KEY` (or tip a creator with no payouts) → the in-app **test sheet** is used instead, and earnings still credit in-app.

Tips for verifying webhooks: in the Stripe Dashboard → Developers → Webhooks, watch deliveries to `…/api/payments/webhook`; you can also use the Stripe CLI (`stripe listen --forward-to .../api/payments/webhook`) locally.

## Notes
- Use Stripe **test mode** keys + test cards first; flip to live keys when ready.
- On iOS, selling digital goods may require Apple In-App Purchase rather than
  Stripe — check Apple's rules for your use case (physical goods are exempt).
