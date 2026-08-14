# Chile financial provider adapters

Black Swan Banking is provider-neutral. Canonical accounting and reconciliation stay in Postgres; Cloudflare Workers own provider credentials, webhook verification, API calls, retries and normalization.

## Recommended order

### 1. Fintoc
Primary adapter for Chile bank connectivity, balances/movements and payment initiation where enabled.

Connection requirements:
- Fintoc API key in Cloudflare secret storage.
- One canonical `bank_connections` row per legal entity/provider connection.
- One or more canonical `bank_accounts` rows mapped to the provider account identifiers.
- Webhook endpoint: `/v1/banking/webhooks/fintoc/{bank_connection_id}`.
- Fintoc webhook secret stored in `FINANCIAL_PROVIDER_WEBHOOK_SECRETS_JSON` under the connection UUID.
- If outbound transfer APIs are ever enabled, keep the Fintoc JWS private key only in Cloudflare secrets and require a separate approval workflow before any money-moving call.

### 2. Khipu
Chile account-to-account payments plus Open Finance fallback/secondary coverage.

Connection requirements:
- Receiver/collector ID and API key in Cloudflare secrets.
- Webhook endpoint: `/v1/banking/webhooks/khipu/{bank_connection_id}`.
- Merchant secret stored per connection in `FINANCIAL_PROVIDER_WEBHOOK_SECRETS_JSON`.
- Use notification API v3.0 for new payments.

### 3. Transbank / Webpay
Local Chile card gateway for Foundation payments, event fees or other card use cases.

Connection requirements:
- Commerce code and API key in Cloudflare secrets.
- Keep Webpay transaction create/commit/status calls inside the Transbank adapter.
- Never treat the browser return URL as proof of payment; confirm the transaction server-side before creating a canonical cash/payment event.

### 4. Stripe
Optional global payment adapter. Do not make Stripe a Chile-native assumption. Activate only if the contracting legal entity has an eligible Stripe account in a supported jurisdiction.

Connection requirements:
- Stripe secret key and webhook secret in Cloudflare secrets.
- Webhook endpoint: `/v1/banking/webhooks/stripe/{bank_connection_id}`.
- Use Stripe event IDs for idempotency.

## Security boundary

Provider webhook → signature verification → restricted machine RPC → `bank_ingestion_events`.

A webhook cannot:
- post journals;
- approve accounting documents;
- approve reconciliation;
- approve payments;
- change user permissions;
- access private HR data.

Provider secrets are never stored in Postgres. Postgres stores only connection metadata, canonical account mappings and audited provider events.

## Activation checklist per legal entity

1. Create/approve the canonical legal entity.
2. Create a `bank_connections` row with the provider key and test environment.
3. Create canonical `bank_accounts` rows.
4. Create a high-entropy `BANK_WEBHOOK_MACHINE_TOKEN`; store only its SHA-256 hash in `bank_webhook_machine_tokens` and the clear token in Cloudflare secrets.
5. Add the provider webhook/merchant secret to `FINANCIAL_PROVIDER_WEBHOOK_SECRETS_JSON` keyed by `bank_connection_id`.
6. Register the HTTPS Worker webhook URL in the provider sandbox/dashboard.
7. Send provider test events and confirm idempotent `bank_ingestion_events` creation.
8. Map provider accounts to canonical `bank_accounts`.
9. Enable movement/balance normalization in test mode.
10. Validate reconciliation proposals with accounting.
11. Promote the connection to production only after sign-off.
