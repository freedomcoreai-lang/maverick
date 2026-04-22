# Stripe Subscription Setup (fiat rail)

Complete this after - or in parallel with - the $MAV token launch. Takes about 30 minutes end to end.

## 1. Create Stripe account

1. Go to https://stripe.com/register → sign up with freedomcoreai@gmail.com
2. Verify your identity (business info + ID). Stripe needs this to accept live payments. Can take 24h.
3. While waiting, you can work in **Test mode** (toggle top-right of dashboard). All keys below have a test and live version - use test first, flip to live after you verify.

## 2. Create the three recurring prices

In the Stripe dashboard → **Products** → **+ Add product**. Create these three:

### Observer
- Name: `MAVERICK Observer`
- Description: `Tier 1 access - Watch the live swarm evolution, DNA reports, performance dashboard.`
- Pricing: **$29.00 USD** / month, recurring
- Copy the **price_id** (starts `price_...`) - you'll need it

### Signal
- Name: `MAVERICK Signal`
- Description: `Tier 2 access - Real-time trade signals, ntfy alerts, swarm prompt vote.`
- Pricing: **$99.00 USD** / month, recurring
- Copy the price_id

### Sovereign
- Name: `MAVERICK Sovereign`
- Description: `Tier 3 access - Copy-trading webhook, custom risk overrides, API access.`
- Pricing: **$499.00 USD** / month, recurring
- Copy the price_id

## 3. Grab your API keys

Dashboard → **Developers** → **API keys**:

- **Publishable key**: `pk_live_...` (safe for frontend)
- **Secret key**: `sk_live_...` (SERVER ONLY - never commit, never share)

## 4. Set up the webhook endpoint

Dashboard → **Developers** → **Webhooks** → **+ Add endpoint**

- **Endpoint URL:** `https://freedomcore.io/api/sub/webhook`
- **Events to listen for:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

After creating, click the endpoint → reveal the **signing secret** (starts `whsec_...`). Copy it.

## 5. Fill in `/root/Maverick_Web_Modular/subscription_gate_config.py`

```python
STRIPE_ENABLED = True

STRIPE_PUBLISHABLE_KEY = "pk_live_..."
STRIPE_SECRET_KEY      = "sk_live_..."
STRIPE_WEBHOOK_SECRET  = "whsec_..."

PRICE_OBSERVER  = "price_..."    # from step 2
PRICE_SIGNAL    = "price_..."
PRICE_SOVEREIGN = "price_..."

SITE_URL = "https://freedomcore.io"
```

Restart the backend:
```
systemctl restart maverick-dashboard
```

Smoke test:
```
curl -H "X-API-Key: fcweb_60fd94aa2d910f38a9f3e0557076791a" \
     https://freedomcore.io/api/sub/plans
# Should show "stripe_enabled": true and real price_ids in the response
```

## 6. Add transactional email (magic-link login)

Without SMTP configured, subscribers can still subscribe but can't get a sign-in link later. Easy fix:

### Option A - Postmark (recommended, $15/mo for up to 10k emails)
1. Sign up https://postmarkapp.com
2. Verify your sending domain (add DNS records)
3. Create a server → copy the server API token

In `subscription_gate_config.py`:
```python
MAGIC_LINK_FROM_EMAIL = "access@freedomcore.io"
SMTP_HOST = "smtp.postmarkapp.com"
SMTP_PORT = 587
SMTP_USER = "YOUR_POSTMARK_TOKEN"
SMTP_PASS = "YOUR_POSTMARK_TOKEN"      # same token as user and pass for Postmark
```

### Option B - Gmail SMTP (free, limited to 500/day)
Use an app-specific password on freedomcoreai@gmail.com. Not recommended for scale but fine for day-1.

## 7. Test the full purchase flow

1. Switch the Stripe dashboard to **Test mode** (top right)
2. Use test keys in `subscription_gate_config.py` temporarily
3. Restart `maverick-dashboard`
4. On https://freedomcore.io/pages/access.html - click **Subscribe**, enter a test email
5. In Checkout, use the Stripe test card: **4242 4242 4242 4242** (any future expiry, any 3-digit CVC, any ZIP)
6. Should redirect back with `?sub=success` and show the Subscribed tile with your tier pill

If that works, swap in **live** keys and you're earning.

## 8. Optional - hardening

- **CSP update:** Stripe Checkout is hosted on Stripe's domain, but Checkout redirects you there, so no CSP change needed. However if you ever embed Stripe Elements inline, add to nginx CSP:
  ```
  script-src 'self' https://js.stripe.com;
  frame-src https://js.stripe.com https://hooks.stripe.com;
  ```
- **Retry policy:** Stripe will retry failed card charges automatically for 3 weeks before canceling the subscription. We do nothing - their retry logic is solid.
- **Tax:** Enable Stripe Tax ($0.50 per successful transaction, auto-collects VAT for EU/UK customers).

## 9. Refund policy (recommended)

Put this on /pages/access.html FAQ:
> **Refunds:** First 7 days, full refund on request (email freedomcoreai@gmail.com). After 7 days, subscriptions are month-to-month, cancel anytime from the billing portal.

Cheap goodwill, stops chargebacks, meets Stripe's policy requirements.

## 10. First revenue - ship it

When Stripe Live mode is active + first subscriber clicks through:
- Webhook fires `checkout.session.completed`
- Backend writes subscriber row with tier + period_end
- User auto-routed back to /pages/access.html?sub=success
- Magic-link login flow works forever after

You start earning the moment step 7 passes with live keys. Stripe payout lands in your bank 2-7 days after first charge.

---

## Summary - decision points for you when you wake up

1. **Sign up Stripe** - 10 minutes
2. **Create 3 prices** - 5 minutes
3. **Fill config file** - 2 minutes
4. **Register webhook** - 3 minutes
5. **Restart dashboard** - 1 minute
6. **Test with 4242 card** - 5 minutes
7. **Announce on X + Farcaster** - however long you want to make the copy sing

Go make it work.

- Claude (Opus 4.7, built while you slept)
