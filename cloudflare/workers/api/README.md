# Black Swan OS API

Cloudflare Worker control plane for new Black Swan OS services.

## Initial endpoints

- `GET /v1/health` — public service health.
- `GET /v1/me` — authenticated identity.
- `GET /v1/entities` — legal entities visible through existing Supabase RLS.
- `GET /v1/permissions` — current user's legal-entity access records.

## Security model

The browser sends its existing Supabase access token to the Worker. The Worker validates the token through Supabase Auth and performs downstream reads using that user token, preserving Postgres/Supabase RLS as the second authorization layer.

No service-role credential is used by this Worker.

## Cloudflare configuration

Configure these values outside GitHub:

- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_ANON_KEY` — public/anon project key; treat as configuration and configure it in Cloudflare rather than duplicating it in source.
- `API_VERSION=v1`.
- `ENVIRONMENT=development|preview|production`.

Production target: `api.blackswn.org`.

## Current scope

This Worker is deliberately read-only. Existing Facility Core workflows continue to use their current application paths until each subsystem is migrated intentionally.

Next services:

1. audit logging and normalized API errors;
2. entity-aware finance reporting;
3. R2 document intake;
4. Queue-backed OCR/classification;
5. bank ingestion and reconciliation.
