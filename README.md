# CHRVA Modernized Application

This folder is the local Angular + API replacement workspace. It is separate from
the FTP mirror and must not be uploaded to the legacy FTP server.

## What Exists Now

- `frontend/`: Angular 21 standalone application shell with routes for Overview,
  Clubs, Coordinators, Tournaments, and Migration Inventory.
- `api/`: Vercel serverless API entrypoint using SQL Server models for the first migration
  contracts:
  - `GET /api/health`
  - `GET /api/auth/session`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/config`
  - `GET /api/clubs`
  - `POST /api/clubs`
  - `PUT /api/clubs/:clubCode`
  - `GET /api/clubs/export`
  - `GET /api/clubs/email-broadcast`
  - `POST /api/clubs/email-broadcast`
  - `GET /api/coordinators`
  - `GET /api/tournaments`
  - `PUT /api/tournaments/:id/added-to-aes`
  - `PUT /api/tournaments/:id/ok-to-pay`
  - `GET /api/migration/inventory`
- `server/`: shared backend code used by both Vercel and local API development.

## First Data Slice

The first data slice exposes clubs, coordinators, and tournaments from SQL
Server through API contracts. The modern app does not read configuration from
the mirrored server-rendered application.

Overview and season config remain public. All other migrated routes require a
signed session cookie. The initial roles are:

- `master`: full access, including Migration.
- `toolsAdmin`: access to migrated tools except Migration.

Runtime configuration comes from environment files:

- `.env.test` for test
- `.env.prod` for production

The checked-in `.env.*.example` files document the required variables:

- `CHRVA_DB_HOST`
- `CHRVA_DB_PORT`
- `CHRVA_DB_NAME`
- `CHRVA_DB_USER`
- `CHRVA_DB_PASSWORD`
- `CHRVA_DB_ENCRYPT`
- `CHRVA_DB_TRUST_SERVER_CERT`
- `CHRVA_PREVIOUS_SEASON`
- `CHRVA_CURRENT_SEASON`
- `CHRVA_NEXT_SEASON`
- `CHRVA_SEASON_STATUS`
- `CHRVA_SANCTION_STATUS`
- `CHRVA_SANCTION_FEE_PER_TEAM`
- `CHRVA_SANCTION_NET_INCOME_LIMIT`
- `CHRVA_AUTH_SECRET`
- `CHRVA_EMAIL_DRY_RUN`
- `CHRVA_SMTP_HOST`
- `CHRVA_SMTP_PORT`
- `CHRVA_SMTP_SECURE`
- `CHRVA_SMTP_STARTTLS`
- `CHRVA_SMTP_TLS_SERVERNAME`
- `CHRVA_SMTP_USER`
- `CHRVA_SMTP_PASSWORD`
- `CHRVA_SMTP_HELO`

On Vercel, add those same names as Project Environment Variables. Do not commit
real SQL Server credentials.

`CHRVA_SANCTION_FEE_PER_TEAM` and `CHRVA_SANCTION_NET_INCOME_LIMIT` control the
sanction request worksheet calculations. Update them in Vercel and redeploy to
change the values without a code change.

Email delivery is used by club-director broadcasts, tournament-director
broadcasts, and sanction request submission confirmations. Outgoing email uses
`no-reply@chrvajuniors.org` as the sender and appends a non-monitored mailbox
footer. Keep
`CHRVA_EMAIL_DRY_RUN=true` in local/test environments unless a real SMTP server
is intentionally configured.

If the SMTP host is a customer-domain alias whose TLS certificate is issued to
the mail provider instead, keep `CHRVA_SMTP_HOST` as the connection host and set
`CHRVA_SMTP_TLS_SERVERNAME` to a DNS name listed on the provider certificate.
For example, Hostek-hosted mail aliases that present a `hostek.com` certificate
should use `CHRVA_SMTP_TLS_SERVERNAME=hostek.com` instead of disabling TLS
verification.

## Vercel Deployment

Deploy from this `modernized/` directory. `vercel.json` builds the Angular app
and serves it from `frontend/dist/frontend/browser`, while `/api/*` is handled by
the Vercel Web function in `api/index.mjs`.

The frontend intentionally calls relative `/api` URLs. In production, Vercel
serves the Angular files and backend function from the same origin.

## Run Locally

From `modernized/`:

```powershell
npm install
npm run start:api:test
```

You can still run the API scripts from `modernized/api`:

```powershell
npm start
npm run start:test
npm run start:prod
```

Create `.env.test` and `.env.prod` from their example files before starting the
API. Those real environment files are ignored by git. `npm start` uses the prod
environment by default; use `npm run start:test` when the test database
credentials are available.

From `modernized/frontend`, after installing dependencies:

```powershell
npm install
npm start
```

Angular 21 requires Node `^20.19.0 || ^22.12.0 || >=24.0.0`.

The Angular app expects API requests under `/api`. During development, add a
proxy or serve both apps behind the same local host.

## Local SQL Server

Local SQL Server setup lives in `db/`. It starts with only the tables the
modern Angular/API app currently needs:

- `clubcontacts`
- `coordcontacts`
- `sanction_requested`

Use `db/docker/start-sqlserver.ps1` to run SQL Server Developer Edition in
Docker, then apply the table scripts from `db/tables/`. Add more table scripts
only when a modern feature starts using that table.
