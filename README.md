# CHRVA Modernized Application

This folder is the local Angular + API replacement workspace. It is separate from
the FTP mirror and must not be uploaded to the legacy FTP server.

## What Exists Now

- `frontend/`: Angular 21 standalone application shell with routes for Overview,
  Clubs, Tournaments, and Migration Inventory.
- `api/`: dependency-free Node API stub that exposes the first migration
  contracts:
  - `GET /api/health`
  - `GET /api/config`
  - `GET /api/clubs`
  - `GET /api/tournaments`
  - `GET /api/migration/inventory`

## First Migrated Slice

The first slice maps these ColdFusion pages:

- `contacts_clubs/clubs_search.CFM`
- `contacts_clubs/clubs_results.CFM`
- `contacts_clubs/clubs_detail.CFM`
- `tournadmin/tourn_findDetail112016.CFM`
- `tournadmin/tourn_findDetailResults.CFM`

The API currently returns fixtures for clubs and tournaments. The next step is
to connect the API to the legacy database and preserve the CFML filters.

## Run Locally

From `modernized/api`:

```powershell
npm start
```

From `modernized/frontend`, after installing dependencies:

```powershell
npm install
npm start
```

Angular 21 requires Node `^20.19.0 || ^22.12.0 || >=24.0.0`.

The Angular app expects API requests under `/api`. During development, add a
proxy or serve both apps behind the same local host.
