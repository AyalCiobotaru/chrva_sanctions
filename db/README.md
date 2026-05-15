# CHRVA Local SQL Server Dev Database

This folder contains the local database workspace for the Angular/API migration.
It is intentionally small: add tables only when the modern app starts using
them.

## Current Scope

The current Angular/API app needs these tables:

- `clubcontacts`
- `coordcontacts`
- `sanction_requested`

The broader ColdFusion inventory is reference material only. Do not copy legacy
tables into the local database until a modern route, API workflow, or migration
test needs them.

## Start SQL Server With Docker

From the `modernized` repo root:

```powershell
.\db\docker\start-sqlserver.ps1
```

The script creates a SQL Server Developer container named `chrva-sql-dev` on
local port `14333`. It prompts for a local `sa` password unless you pass one:

```powershell
.\db\docker\start-sqlserver.ps1 -SaPassword "Your_Strong_Password_123!"
```

## Create The Local Database

After the container is running:

```powershell
sqlcmd -S localhost,14333 -U sa -P "Your_Strong_Password_123!" -C -i .\db\scripts\create-database.sql
```

## Apply Current App Tables

```powershell
.\db\scripts\apply-current-schema.ps1 -Password "Your_Strong_Password_123!"
```

## Add Another Table Later

1. Add the table name to `manifests/current-app.tables.txt`.
2. Generate or write `tables/<table>.sql`.
3. Add a focused seed file under `seeds/`.
4. Update `.env.test` to point to the local database.

## Seed Current App Data

The current seed file contains only data needed by the active Angular/API
routes:

- all `coordcontacts`
- active junior `clubcontacts`
- inactive or non-junior `clubcontacts` referenced by seeded tournaments
- `sanction_requested` rows for seasons 2025-2027 where the request is
  approved, posted, SO, or has been added to AES

`clubcontacts.password` is written as `NULL` in the seed.

Apply it locally:

```powershell
.\db\scripts\apply-current-seed.ps1
```

## Environment

Use the local Docker database for write testing:

```env
CHRVA_DB_HOST=localhost
CHRVA_DB_PORT=14333
CHRVA_DB_NAME=chrva_juniors_dev
CHRVA_DB_USER=sa
CHRVA_DB_PASSWORD=Your_Strong_Password_123!
CHRVA_DB_ENCRYPT=false
CHRVA_DB_TRUST_SERVER_CERT=true
```
