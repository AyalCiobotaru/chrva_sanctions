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
$seedScript = Join-Path $repoDb "seeds\001_current_app_data.sql"

if (-not (Test-Path -LiteralPath $seedScript)) {
  throw "Missing seed script: $seedScript"
}

& $sqlcmd -S $Server -U $User -P $Password -C -d $Database -i $seedScript
