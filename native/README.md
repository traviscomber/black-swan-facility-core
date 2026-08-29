# Blackswan Facility Core native shell

This isolated workspace packages the production Blackswan Facility Core web application as an iOS/Android Capacitor shell without adding native dependencies to the root Next.js application.

## Identity

- App name: `Blackswan Facility Core`
- Bundle/application id: `app.blackswn.facilitycore`
- Production origin: `https://blackswn.app`
- Native workspace: `native/`

## Build workflow

1. Run `pnpm install` inside `native/`.
2. Run `pnpm doctor`.
3. Run `pnpm add:ios` and/or `pnpm add:android` once on a machine with the required native SDKs.
4. Run `pnpm sync` after configuration changes.
5. Open the generated project with `pnpm open:ios` or `pnpm open:android`.
6. Configure real signing identities, store teams, icons/splash assets and privacy declarations in the native IDE projects.
7. Build an actual signed archive/bundle and test on physical devices before release.

## Security and data rules

The shell loads only the HTTPS production origin. Mixed content is disabled. Orchard operational mutations remain network-first: harvest, care, health, nursery, inventory and task changes must not be silently queued and replayed after connectivity returns.

Do not commit signing certificates, provisioning profiles, keystores, store API keys or service-account credentials.

## Release gate

This repository being native-ready does **not** mean the product has been published to the Apple App Store or Google Play. A release is complete only after a signed native build is produced, device-tested and accepted/distributed through the intended channel.
