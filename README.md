# CHRVA Modernized Application

This folder is the local Angular + API replacement workspace. It is separate from
the FTP mirror and must not be uploaded to the legacy FTP server.

## What Exists Now

- `frontend/`: Angular 21 standalone application shell with routes for Overview,
  Clubs, Coordinators, Tournaments, and Migration Inventory.
- `api/`: Node API using SQL Server read models for the first migration
  contracts:
  - `GET /api/health`
  - `GET /api/config`
  - `GET /api/clubs`
  - `GET /api/coordinators`
  - `GET /api/tournaments`
  - `GET /api/migration/inventory`

## First Data Slice

The first data slice exposes clubs, coordinators, and tournaments from SQL
Server through API contracts. The modern app does not read configuration from
the mirrored server-rendered application.

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

## Run Locally

From `modernized/api`:

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
