# Black Swan Documents Worker

Cloudflare-native intake path for invoices, receipts, donation slips, payment evidence, bank documents and other accounting source material.

## Implemented flow

1. Authenticated user calls `POST /v1/documents/intake` with multipart field `file`.
2. Worker validates the existing Supabase session token.
3. Original file is stored in the `DOCUMENTS_BUCKET` R2 binding.
4. A review-first `accounting_document_intake` row is created using the user's token and existing RLS.
5. A minimal OCR job containing only intake ID, storage key and file metadata is sent to `OCR_QUEUE`.
6. The API responds `202 Accepted`.

The upload endpoint does not create journal entries, accounting allocations or canonical postings.

## Important security boundary

The Queue consumer is intentionally not implemented yet.

Queue consumers run asynchronously and do not inherit the originating user's Supabase access token. The consumer therefore needs a dedicated machine identity with narrowly-scoped database capabilities. Do not solve this by exposing a general service-role credential to all Worker code.

Recommended next step:

- create dedicated Postgres RPCs for document-processing state transitions and OCR proposal writes;
- restrict those RPCs to a machine/service identity;
- store that machine credential only as a Cloudflare secret;
- prevent the machine identity from posting accounting entries or approving its own classifications;
- preserve human approval before canonical accounting posting.

## Cloudflare resources

- R2 bucket: `black-swan-documents`
- Queue: `black-swan-ocr`
- Worker binding: `DOCUMENTS_BUCKET`
- Queue producer binding: `OCR_QUEUE`

Names can be changed during Cloudflare provisioning if account naming standards require it; update `wrangler.toml` accordingly.

## Upload limit

Initial Worker-level limit is 25 MiB per source document. This is an application guard, not a statement of Cloudflare platform limits.
