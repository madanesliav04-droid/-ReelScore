# Social+ — Cloudflare R2 Standard (free 10 GB-month)
Status: R2 adapter code prepared. **Do not activate until bucket/CORS/lifecycle/secrets and real video tests are complete.**

## Storage contract
- Supabase retains authentication, relational records and historical videos.
- NEW sources/rushes and new Edit+ exports go to **one private** Cloudflare R2 Standard bucket when server-side R2 variables are present. Historical Supabase media remain readable.
- Every newly uploaded video is limited to **200,000,000 bytes (200 MB)**, validated in browser and Edge API.
- One-day bucket lifecycle expiration applies to newly uploaded R2 files (sources AND exports). Inform users that both rushes and exported MP4s will be deleted; downloads must happen within 24h. R2 may delete objects up to ~24h after expiration, so do not rely on the exact minute.
- Deleting an R2 object does not remove its Supabase record automatically; the UI must handle an expired 404 gracefully. Future cleanup should mark orphaned media_assets rows, not pretend they remain playable.
- Existing Supabase media must NOT be deleted or moved without a separately validated migration/backup.
- **Free tier is an included 10 GB-month average**, not a guaranteed hard 10 GB capacity cutoff. Cloudflare bills excess usage and operations. Review usage dashboards and enable billing alerts. Do not market unlimited users or guaranteed 0€.

## Account preparation (needs owner login)
1. Create an R2 bucket on the owner's Cloudflare account in **Standard** storage. The bucket must remain private.
2. Apply the CORS policy below, replacing SITE_ORIGIN with the deployed Social+ origin.
3. Apply a 24h object-expiration lifecycle for all objects in this *new dedicated bucket*; do NOT apply it to a bucket containing archives.
4. Generate a **scoped** R2 S3 API token allowing only read/write to this bucket.
5. Configure the following secrets in **Supabase Edge Function** (viral-edit-jobs) AND in the **Railway video-worker** service (never browser, never git):
   - R2_ACCOUNT_ID (32 hex chars)
   - R2_ACCESS_KEY_ID
   - R2_SECRET_ACCESS_KEY
   - R2_ENABLED (set to `true` only after both API and worker are fully configured)
   - R2_BUCKET_NAME
6. Deploy updated viral-edit-jobs Edge Function including r2-sign.js. Deploy the worker and frontend from this tested branch. Keep `R2_ENABLED` unset until rollout checks pass on a test environment.
7. Verify upload, transcription, Edit+ render, signed preview, signed export and expiry with a real video. Then activate for users.

### Example CORS policy
```json
{
  "rules": [{
    "allowed": {
      "origins": ["https://viral-studio-preview-production.up.railway.app"],
      "methods": ["GET","HEAD","PUT"],
      "headers": ["Content-Type"]
    },
    "exposeHeaders": ["ETag"],
    "maxAgeSeconds": 3600
  }]
}
```

### Example lifecycle policy
```json
{
  "rules": [{
    "id": "socialplus-delete-after-24h",
    "enabled": true,
    "conditions": {"prefix": ""},
    "deleteObjectsTransition": {"condition": {"type": "Age", "maxAge": 86400}}
  }]
}
```

Cloudflare API endpoints:
- `PUT /client/v4/accounts/{account_id}/r2/buckets/{bucket_name}/cors`
- `PUT /client/v4/accounts/{account_id}/r2/buckets/{bucket_name}/lifecycle`

**Warning:** these PUT endpoints replace existing policies. Inspect current policies before applying. Use a dedicated empty bucket.

## Rollout checks
- Never put R2 secret access keys in the Next client, GitHub source or exported JSON.
- `GET /api/viral-edit-jobs/storage-config` responds `provider: "r2"` only when Edge secrets are set.
- User-scoped signed upload ticket, 200MB limit, server HEAD verification of uploaded object size, private 10-minute signed playback/download.
- Worker must have the same R2 credentials, or uploaded videos cannot be rendered.
- Uploads currently use one signed PUT request, not resumable S3 multipart. Test specifically on unreliable mobile connections before launch.
- Expiration after 24h means the user's export cannot be recovered from R2 after deletion. Offer download immediately.
- The 10 GB-month free allocation **does not reset the number of bytes transferred every month** and is not a hard quota. Billing can occur if average storage or operation allowances are exceeded.

References:
https://developers.cloudflare.com/r2/pricing/
https://developers.cloudflare.com/r2/buckets/object-lifecycles/
https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/lifecycle/methods/update/
