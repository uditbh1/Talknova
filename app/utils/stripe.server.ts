/* utils/stripe.server.ts
   — central Stripe helpers for your Remix app —                     */
/* ----------------------------------------------------------------- */
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // uses account‑pinned API version

/* ----------------------------------------------------------------- */
/* 1 ▸ Build an on‑the‑fly Checkout Session (recurring, price_data)   */
/* ----------------------------------------------------------------- */
export async function createCheckoutSession(opts) {
  const {
    amountPence, // 1299   → £12.99
    currency, // 'GBP'
    planName, // e.g. "BUSINESS"
    clientReferenceId, // Mongo Tx _id
    customerEmail, // pre‑filled email box
    tx, // the Transaction doc (for metadata)
    successPath = 'payment-response',
    cancelPath = 'payment-response',
  } = opts;

  // Ensure SITE_URL has a trailing slash for proper URL construction
  const baseUrl = process.env.SITE_URL || 'https://talknova.ai';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  // Ensure paths don't start with slash since baseUrl already has one
  const normalizedSuccessPath = successPath.startsWith('/') ? successPath.slice(1) : successPath;
  const normalizedCancelPath = cancelPath.startsWith('/') ? cancelPath.slice(1) : cancelPath;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: customerEmail,
    client_reference_id: clientReferenceId,
    metadata: { mongoTxId: tx._id, plan: tx.plan, user: tx.user }, // ← stored in Stripe
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountPence,
          recurring: { interval: 'month' }, // monthly billing
          product_data: { name: planName },
        },
      },
    ],
    success_url: `${normalizedBase}${normalizedSuccessPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${normalizedBase}${normalizedCancelPath}?canceled=1`,
  });

  return { url: session.url, id: session.id };
}

/* ----------------------------------------------------------------- */
/* 2 ▸ Simple “get” helpers                                           */
/* ----------------------------------------------------------------- */
export function retrieveCheckoutSession(sessionId) {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['customer', 'subscription'],
  });
}

export function retrieveSubscription(subId) {
  return stripe.subscriptions.retrieve(subId, {
    expand: ['latest_invoice.payment_intent', 'plan.product'],
  });
}

export function listCustomerSubscriptions(customerId, limit = 10) {
  return stripe.subscriptions.list({ customer: customerId, limit });
}

/* ----------------------------------------------------------------- */
/* 3 ▸ Subscription life‑cycle helpers                               */
/* ----------------------------------------------------------------- */

/** Cancel now or at period end (default true = let it run to renewal) */
export function cancelSubscription(subId, atPeriodEnd = true) {
  return stripe.subscriptions.update(subId, {
    cancel_at_period_end: atPeriodEnd,
  });
}

/** Change the price (upgrade / downgrade) or seat count on a subscription */
export async function updateSubscription({ subId, newPriceId, quantity = 1, proration = true }) {
  // Make sure the price exists: it can be created in Dashboard *or* via API
  //   const price = await stripe.prices.create({ ... })  // if you want to do it on‑demand
  const sub = await stripe.subscriptions.retrieve(subId);
  const itemId = sub.items.data[0].id; /* docs: change price :contentReference[oaicite:2]{index=2} */

  return stripe.subscriptions.update(subId, {
    proration_behavior: proration ? 'create_prorations' : 'none',
    items: [
      {
        id: itemId,
        price: newPriceId,
        quantity,
      },
    ],
  });
}

/* ----------------------------------------------------------------- */
/* 4 ▸ Price utilities – create or fetch on demand                    */
/* ----------------------------------------------------------------- */

/** Create a recurring monthly Price (and Product) entirely in code */
export async function createRecurringPrice({ amountPence, currency, productName }) {
  const product = await stripe.products.create({ name: productName });
  const price = await stripe.prices.create({
    /* create price API :contentReference[oaicite:3]{index=3} */ unit_amount: amountPence,
    currency,
    recurring: { interval: 'month' },
    product: product.id,
  });
  return price.id; // store this in your Plan doc for later use
}
