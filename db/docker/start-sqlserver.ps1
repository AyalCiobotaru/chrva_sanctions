param(
  [string]$ContainerName = "chrva-sql-dev",
  [string]$Image = "mcr.microsoft.com/mssql/server:2022-latest",
  [int]$HostPort = 14333,
  [string]$VolumeName = "chrva-sql-dev-data",
  [string]$SaPassword = $env:CHRVA_LOCAL_SQL_SA_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not $SaPassword) {
  $secure = Read-Host "Local SQL Server sa password" -AsSecureString
  $SaPassword = [System.Net.NetworkCredential]::new("", $secure).Password
}

if (-not $SaPassword) {
  throw "A local SQL Server sa password is required."
}

$existing = docker ps -a --filter "name=^/$ContainerName$" --format "{{.Names}}"

if ($existing -eq $ContainerName) {
  $running = docker ps --filter "name=^/$ContainerName$" --format "{{.Names}}"

  if ($running -eq $ContainerName) {
    Write-Host "Container $ContainerName is already running on localhost,$HostPort."
    exit 0
  }

  docker start $ContainerName | Out-Host
  Write-Host "Started existing container $ContainerName on localhost,$HostPort."
  exit 0
}

docker volume create $VolumeName | Out-Host

docker run `
  --name $ContainerName `
  -e "ACCEPT_EULA=Y" `
  -e "MSSQL_SA_PASSWORD=$SaPassword" `
  -e "MSSQL_PID=Developer" `
  -p "${HostPort}:1433" `
  -v "${VolumeName}:/var/opt/mssql" `
  -d $Image | Out-Host

Write-Host "Started $ContainerName on localhost,$HostPort."

# docker run `
#   --name chrva-sql-dev `
#   -e "ACCEPT_EULA=Y" `
#   -e "MSSQL_SA_PASSWORD=Your_Strong_Password_123!" `
#   -e "MSSQL_PID=Developer" `
#   -p 14333:1433 `
#   -v chrva-sql-dev-data:/var/opt/mssql `
#   -d mcr.microsoft.com/mssql/server:2022-latest
