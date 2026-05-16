param(
  [string]$Server = "localhost,14333",
  [string]$Database = "chrva_juniors_dev",
  [string]$User = "sa",
  [string]$Password = $env:CHRVA_LOCAL_SQL_SA_PASSWORD
)

$ErrorActionPreference = "Stop"

function Resolve-SqlCmd {
  $pathCommand = Get-Command sqlcmd -ErrorAction SilentlyContinue

  if ($pathCommand) {
    return $pathCommand.Source
  }

  $knownPaths = @(
    "C:\Program Files\SqlCmd\sqlcmd.exe",
    "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\sqlcmd.exe",
    "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\130\Tools\Binn\sqlcmd.exe"
  )

  foreach ($knownPath in $knownPaths) {
    if (Test-Path -LiteralPath $knownPath) {
      return $knownPath
    }
  }

  throw "sqlcmd was not found. Install sqlcmd or add it to PATH."
}

if (-not $Password) {
  $secure = Read-Host "Local SQL Server password for $User" -AsSecureString
  $Password = [System.Net.NetworkCredential]::new("", $secure).Password
}

$sqlcmd = Resolve-SqlCmd
$repoDb = Resolve-Path (Join-Path $PSScriptRoot "..")
$tableManifest = Join-Path $repoDb "manifests\current-app.tables.txt"

& $sqlcmd -S $Server -U $User -P $Password -C -i (Join-Path $repoDb "scripts\create-database.sql")

Get-Content $tableManifest |
  Where-Object { $_.Trim() -and -not $_.Trim().StartsWith("#") } |
  ForEach-Object {
    $table = $_.Trim()
    $script = Join-Path $repoDb "tables\$table.sql"

    if (-not (Test-Path -LiteralPath $script)) {
      throw "Missing table script: $script"
    }

    & $sqlcmd -S $Server -U $User -P $Password -C -d $Database -i $script
  }
