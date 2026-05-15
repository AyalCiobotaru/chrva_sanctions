param(
  [string]$Server = "localhost,14333",
  [string]$Database = "chrva_juniors_dev",
  [string]$User = "sa",
  [string]$Password = $env:CHRVA_LOCAL_SQL_SA_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not $Password) {
  $secure = Read-Host "Local SQL Server password for $User" -AsSecureString
  $Password = [System.Net.NetworkCredential]::new("", $secure).Password
}

$repoDb = Resolve-Path (Join-Path $PSScriptRoot "..")
$seedScript = Join-Path $repoDb "seeds\001_current_app_data.sql"

if (-not (Test-Path -LiteralPath $seedScript)) {
  throw "Missing seed script: $seedScript"
}

sqlcmd -S $Server -U $User -P $Password -C -d $Database -i $seedScript
