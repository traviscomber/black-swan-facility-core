# Black Swan OCR Worker

Queue consumer for accounting document extraction. It reads source files from R2 and can only write review-first OCR/classification proposals through dedicated machine RPCs.

## Security boundary

The Worker must **not** receive a Supabase service-role key.

It uses:

- `SUPABASE_ANON_KEY` for PostgREST transport;
- `OCR_MACHINE_TOKEN` as a separate machine credential;
- dedicated RPCs protected by `x-black-swan-machine-token`;
- narrow scopes `ocr:write` and `ocr:reference`.

The token is stored in Postgres only as a SHA-256 hash in `machine_principals`.

The machine RPCs can only:

1. claim an intake row for extraction;
2. read the approved OCR reference catalog;
3. write OCR text and proposed classifications;
4. mark OCR processing as failed.

They cannot approve/post accounting documents, create journals, reconcile cash, approve payments, read private HR records, or modify user/legal-entity access.

## Canonical reference grounding

Before sending a document to the extraction provider, the Worker loads a restricted catalog containing only active:

- legal entities;
- entity departments;
- cost centers;
- accounting counterparties.

The extraction provider receives these IDs as the only valid canonical identifiers. The Worker validates returned IDs against the same catalog and converts unknown IDs to `null` before writing a proposal.

This prevents model-generated UUIDs from entering the intake layer.

## Provisioning

Do not commit a machine token.

After the migrations have been tested and approved for the target environment:

1. generate a high-entropy token outside the repository;
2. store the plaintext token only as Cloudflare secret `OCR_MACHINE_TOKEN`;
3. insert only `digest(<token>, 'sha256')` into `machine_principals` with scopes `ocr:write` and `ocr:reference`;
4. rotate by creating a new principal/token, switching the Worker secret, then disabling the old principal.

No principal/token is seeded by the migration.

## Document AI adapter

The Worker intentionally uses a configurable `DOCUMENT_AI_ENDPOINT` rather than hard-coding one OCR/model vendor. The endpoint receives the document, extraction schema and canonical reference catalog and must return structured JSON.

This allows us to benchmark Cloudflare Workers AI, external document models, or other providers without changing the canonical accounting pipeline.

Required configuration:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OCR_MACHINE_TOKEN`
- `DOCUMENT_AI_ENDPOINT`
- `DOCUMENT_AI_TOKEN` when required by the provider
- `MODEL_PROVIDER`
- `MODEL_NAME`

## Processing contract

`R2 -> Queue -> ocr_claim_intake -> ocr_get_reference_catalog -> extraction provider -> local ID validation -> ocr_write_proposal`

On failure the Worker calls `ocr_mark_failed`; Cloudflare Queue retries up to the configured retry limit.

Every successful extraction remains `requires_review=true`.
