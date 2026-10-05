# PayMongo TEST checkout

## Configuration

The API reads the repository root `.env` through its existing `--env-file=../../.env` startup option. Never add secret values to frontend variables, source files, or Git.

- `PAYMONGO_SECRET_KEY`: a PayMongo test secret key; live keys are rejected.
- `PAYMONGO_WEBHOOK_SECRET`: signing secret for your **test** webhook endpoint. Missing configuration returns 503 and cannot mark orders paid.
- `APP_URL`: the actual PetNest frontend base URL, configured **on the API**. The repository identifies the API deployment but does not reliably identify the frontend production domain. Copy the frontend project's production URL from Vercel; do not use the API URL. For local development the default is `http://localhost:5173`. In production there is no guessed default.

For a deployed frontend, success and cancel URLs are respectively `APP_URL/orders?payment=success&order=<id>` and `APP_URL/orders?payment=cancel&order=<id>`. These query parameters never change payment status. The order list polls backend status after a successful return until that order is paid.

## Flow and persistence

Existing MongoDB `orders`, customer cookie authentication, provider confirmation, and snapshot product prices are reused. Initial checkout still creates an unpaid pending order. Only confirmed orders owned by the authenticated customer may use `POST /api/orders/:orderId/payment`. Pickup and delivery both qualify; fulfillment and delivery-address validation are unchanged. Grooming and vaccination have no payment endpoints.

Existing `paymentStatus` and `paymentMethod` are reused. Optional internal fields are written only as needed: `paymentAttemptId`, `paymentAttemptState`, `paymentAmountCentavos`, `paymongoCheckoutSessionId`, `paymongoCheckoutUrl`, `paymongoPaymentReference`, and `paidAt`. No reset, destructive migration, or historical-price recalculation occurs. Older orders without payment fields default to unpaid.

Saved unit prices are rounded to centavos, multiplied by saved quantities, and checked against the saved total. The browser cannot specify the amount. Checkout uses `POST https://api.paymongo.com/v2/checkout_sessions`, HTTP Basic authentication, `gcash`, PHP line items, and `pass_on_fees: false`. Only a validated `https://checkout.paymongo.com/` URL is returned. The browser navigates at the top level.

An atomic MongoDB conditional update admits one checkout creation per order. Creation temporarily uses payment Pending; an open, abandoned or cancelled hosted checkout remains Unpaid until verified payment. The internal attempt state stays Active so repeated requests reuse its saved session. PayMongo sessions do not expire automatically, and failed payment attempts can retry inside the same hosted session. Do not manually expire an associated session without reconciling the order first.

A definitive create rejection leaves payment failed and retryable. A timeout, network failure, unexpected response, or server error might have created a checkout; it leaves the attempt locked as `UNCERTAIN` instead of issuing a possible second charge. A crash during creation similarly leaves `CREATING`. Reconcile the saved `paymentAttemptId` against PayMongo before any manual recovery. A correctly signed successful webhook can reconcile such an attempt using that reference even if the creation response was not saved. There is no unsafe automatic unlock.

## Webhook

`POST /api/webhooks/paymongo` receives exact raw JSON bytes; other API JSON routes retain their normal parser. It requires `Paymongo-Signature`, checks the test `te` signature with HMAC-SHA256 over `t + '.' + rawBody`, uses constant-time comparison, and allows a five-minute timestamp tolerance. Live events and live-only signatures are rejected.

Only `checkout_session.payment.paid` marks payment paid. Both documented event envelopes are supported. The handler checks the saved attempt/session association, reference and supplied metadata, confirmed order, one paid GCash payment, PHP currency, and exact expected gross amount. An atomic update stores the payment reference and first `paidAt` without changing order fulfillment status.

Customer and provider notifications use existing records and deterministic per-recipient IDs. `paymentNotificationStatus` is persisted as `PENDING` with the paid transition and becomes `SENT` after delivery. Notification failure is acknowledged with 200 after payment is safely persisted. A verified duplicate or a later customer/provider order-list read retries pending notifications without duplicating records or payment transitions. Valid duplicates are also acknowledged after an already-paid order is completed or archived. No success notification is sent on checkout creation or return.

## Order #39 webhook diagnosis (October 5, 2026)

A direct unsigned empty request to `https://petnest-api.vercel.app/api/webhooks/paymongo` returned **404** with PetNest's **API endpoint not found** response. It reached the deployed API fallback, not the payment webhook handler. The current workspace contains the handler, but the public deployment does not expose it. **REDEPLOY API REQUIRED:** deploy the current API workspace, including `src/lib/paymongo.ts`, `src/routes/petnest.ts`, `src/app.ts`, and the `server.ts` entry point. No deployment was performed during diagnosis.

Read-only MongoDB inspection found Order #39 confirmed and unpaid, with an active attempt and stored checkout session matching `cs_69015bb872679a57319bf43d`. Both saved payment amount and saved item snapshots equal 4000 centavos (PHP 40). No order was manually marked paid and no additional payment was created.

The raw-body parser, test HMAC verification, and two documented event-envelope parsers were checked. Regression tests cover Order #39's reported facts using in-memory fixtures, including a session still active while its payment is paid. Fixtures are never replayed against the real database.

After deploying the API and verifying its Production environment, use PayMongo's Retry/Resend on the **existing** successful Order #39 event. Verify 200 acknowledgement, Paid, payment reference, `paidAt`, and one notification per recipient. Do not start another transaction.

Configure API `APP_URL` with the real frontend production HTTPS URL. Production and Vercel now reject localhost return bases. This affects future checkout sessions; the existing Order #39 checkout keeps its already-created return URLs. The repository does not reliably identify the production frontend domain.

Diagnostic logs record only processing stage and HTTP status, never payloads, signatures, secrets or exception details. The observed production failure was 404 before signature, event or database checks. Deployed secret presence and a match to the registered test endpoint cannot be inferred from that 404; verify both PayMongo variables in Vercel Production settings.

## NEXT MANUAL PAYMONGO SETUP

1. When you choose to deploy this implementation yourself, configure `PAYMONGO_SECRET_KEY` and `APP_URL` on the **API** Vercel project. Local `.env` files are ignored by Git and are not transferred to Vercel automatically.
2. In PayMongo Dashboard, switch to **test mode**, then open **Developers → Webhooks** (also linked as **Settings → Webhooks** in Hosted Checkout documentation). Click **Add endpoint**.
3. Enter exactly `https://petnest-api.vercel.app/api/webhooks/paymongo`.
4. Select exactly `checkout_session.payment.paid`.
5. Save the endpoint and open its details. Obtain that endpoint's webhook signing secret; put it in `PAYMONGO_WEBHOOK_SECRET` on the API. Do not share it in chat or commit it.
6. Restart the local API after changing root `.env`. On Vercel, environment changes require a new API deployment. No deployment was performed by this implementation task.
7. Sign in as a customer, add Pet Supplies products, choose pickup/delivery, enter the required delivery address if applicable, and place the order. Verify Pending has no payment button.
8. Sign in as the assigned provider and confirm the order. Return as the owning customer: Confirmed and Unpaid should show **Proceed to Payment**.
9. Click the button, check the hosted test amount, and complete PayMongo's test GCash experience using only its test simulation. Never use real wallet credentials.
10. Return to PetNest. Wait for a successfully delivered, signed webhook; verify Paid and the two notifications. A return URL alone never verifies payment. Resend the same successful event in the Dashboard to check that no duplicate notifications appear.

Until the signing secret and public endpoint are configured, a real hosted payment cannot complete the PetNest paid-state confirmation. Use a local public HTTPS tunnel if testing webhooks against your local API instead of the deployed API; register that tunnel's `/api/webhooks/paymongo` URL separately in test mode.

## Verification

Run `node --test --test-isolation=none apps/api/tests/paymongo.test.mjs` from the repository root. Tests use synthetic credentials, in-memory orders, and mocked upstream requests; they never load `.env` or modify MongoDB. They exercise the production service and actual payment/webhook route handlers.

Official references: [Hosted Checkout V2](https://docs.paymongo.com/docs/payment-channels-hosted-checkout), [session lifecycle and retry](https://docs.paymongo.com/docs/payment-channels-key-concepts), [webhook setup and signatures](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management).
