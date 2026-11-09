# CARVAMO — isolated OVH preview rollout

Target: https://preview.carvamo.com
Production: https://carvamo.com (MUST remain untouched)

## Preconditions (read-only checks)

On OVH, inspect the actual web server, existing virtual hosts, DNS and certificates before any changes:

```sh
hostname -f
sudo ss -ltnp | grep -E ':(80|443)\b' || true
command -v nginx || true
command -v apache2 || true
sudo nginx -T 2>&1 | grep -E 'server_name|root |proxy_pass|listen ' || true
getent ahostsv4 preview.carvamo.com || true
getent ahostsv4 carvamo.com || true
sudo ls -la /etc/letsencrypt/live 2>/dev/null || true
```

Do not change production DNS, default virtual host, existing TLS certificates or running services until verified.

## Planned isolated architecture

- Separate webroot: `/var/www/carvamo-preview/releases/<commit>`
- Atomic symlink: `/var/www/carvamo-preview/current`
- Dedicated host-based virtual server for `preview.carvamo.com`; never use `default_server`.
- Serve static portal assets (`index.html`, `catalog-live.js`, `assets/`, `panel/`) from a tested Git commit. Do not expose `.git`, credentials, or environment files.
- Restrict preview from indexing with `X-Robots-Tag: noindex, nofollow`; add authentication before exposing real customer or dealer data.
- Configure DNS A/AAAA for preview to the verified OVH ingress, then issue an individual TLS certificate after DNS is confirmed.
- Verify `nginx -t` before reload; do not restart production services.
- Verify preview with HTTPS and Host header; separately confirm production still serves its existing content.
- Roll back by atomically switching `current` to the previous release, then verify again.

## Release gates

1. Confirm OVH DNS/web-server configuration and ownership of domain.
2. Identify and isolate API and Supabase calls. Preview must not mutate production records, send live customer leads or trigger production image workers.
3. Prepare CARVAMO branding without changing internal legacy paths required by integrations.
4. Test static assets, navigation, responsive behavior, authorization and preview isolation.
5. Deploy to preview only, verify HTTPS, and compare production before/after.
6. Add CI-based preview deployment only after the isolated environment is proven.

Status: **PREPARATION ONLY**. No DNS, OVH, production or GitHub Actions changes applied by this document.
