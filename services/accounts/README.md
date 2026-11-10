# CARVAMO OVH Accounts API

Private OVH backend service. No public deployment or initial administrator is created by these files. Endpoints: POST /api/auth/login, GET /api/auth/me, POST /api/auth/change-password, GET/POST /api/accounts, PATCH /api/accounts/{id}/status. Authentication uses signed short-lived bearer tokens. Role and dealer scope are checked in the API and database. Temporary passwords must be changed by users; production rollout requires invitation delivery, brute-force rate limiting, session revocation, HTTPS reverse proxy and audited owner bootstrap before opening traffic.

Never publish DATABASE_URL or SESSION_SECRET to GitHub or the browser. The PostgreSQL staging container is on an internal Docker network and is not internet-facing.
