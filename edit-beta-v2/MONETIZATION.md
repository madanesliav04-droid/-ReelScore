# Monetization architecture

This file defines the commercial model without enabling billing during the private beta.

## Trial
- 14 days OR 3 successful exports, whichever is reached first.
- Owner/admin beta account: unlimited.
- Admin can grant free access, extend trial, assign plan, add credits or remove limits.

## Proposed plans
Prices remain configurable before launch after real render-cost measurement.

### Creator — target 14.99 EUR/month
- Automatic editing
- Premium caption styles
- 1080p exports
- No watermark
- Comfortable monthly processing allowance
- Natural-language edit corrections

### Pro — target 24.99 EUR/month
- Everything in Creator
- 4K exports
- Larger/longer source files
- Higher priority processing when a server renderer is introduced
- Advanced presets / brand kit
- Larger credit allocation

## Credit rule
Do NOT charge credits for ordinary cuts, captions, zooms, caption position or local regeneration.
Credits are reserved for features with a meaningful marginal cost such as third-party generative B-roll, expensive cloud rendering, premium external models or licensed paid media.

## Recommended data model
### users
id, email, created_at, role, trial_started_at, trial_ends_at, free_exports_used

### subscriptions
id, user_id, provider, provider_customer_id, provider_subscription_id, plan, status, current_period_end

### credit_wallets
user_id, balance, updated_at

### credit_ledger
id, user_id, delta, reason, reference_id, created_at

### projects
id, user_id, title, preset, settings_json, status, created_at, updated_at

### media_assets
id, project_id, owner_id, kind, storage_key, bytes, mime_type, expires_at, created_at

### renders
id, project_id, owner_id, quality, status, source_duration_ms, output_duration_ms, credits_used, created_at

### admin_grants
id, user_id, created_by, grant_type, value_json, expires_at, created_at

## Security requirements
- Server-side authorization for every project/media/render row.
- User role must be stored in trusted server-side/app metadata, never user-editable metadata.
- Private storage only; signed URLs for temporary access.
- Source media deletion available immediately.
- Default retention should be short and configurable.
- Stripe webhook must be the source of truth for paid subscription status.
- Admin grants require server-side admin authorization and audit logging.

## Beta mode
Billing, cloud auth and cloud media storage remain disabled until a dedicated backend project can be provisioned. This prevents a browser-only implementation from pretending to provide secure accounts or paid entitlements.
