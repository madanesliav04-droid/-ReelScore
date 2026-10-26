# Cloudflare build — isolated correction, not deployed

Remote check: `Workers Builds: reelscore`, build
`ffca36a0-526b-494b-9827-54828bab31aa`. GitHub exposes failure but no log or
annotation. The authenticated Cloudflare account/build configuration is not
available in this session (no Cloudflare credential binding or connector).
The dashboard URL returns its generic application shell, not the build log.
**The exact remote failure cause cannot be certified without that log.**

An actual local failure was reproduced from the repository root:

```text
Missing entry-point to Worker script or to assets directory
```

The old Wrangler configuration is nested under `cloudflare-worker/`; the root
had no entry point. Its Worker name is `viral-plus-api`, whereas the remote
check targets `reelscore`. Both the root-directory problem and the name mismatch
must be checked against the remote command. They are not proof of the remote
cause by themselves.

The new root `wrangler.jsonc` supplies the explicit script entry point, with the
distinct name **`reelscore-preview`**, no production route/domain/cron binding.
The old Worker configuration and API implementation are unchanged. Compilation
with `wrangler 4.153.0 deploy --dry-run` from the root succeeds. This bundles
locally and does not send a deployment. Authentication checks remain in the API.

Before any remote activation, the owner must inspect the failing build's log,
root directory and command, and isolate preview builds from the `reelscore`
production integration. Do not change the new preview name to match production
merely to make its check green. Do not push this work through an automatic
production deployment hook before approval. Preview credentials must be scoped
and configured privately; no key is stored here. `ALLOWED_ORIGIN` still contains
the pre-existing GitHub Pages origin; an actual preview origin needs explicit
configuration. No remote preview is claimed to be functional.

No deploy, retry, production setting, domain, secret, billing setting or service
was created/changed. The user-requested remote correction remains blocked on
access to the exact build log/settings.
