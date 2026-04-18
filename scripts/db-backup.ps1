$ErrorActionPreference = 'Stop'

$dbUrl = $env:SUPABASE_DB_URL
if ([string]::IsNullOrWhiteSpace($dbUrl)) {
  Write-Error 'SUPABASE_DB_URL nao definido. Ex: postgresql://user:pass@host:5432/postgres'
}

$backupDir = if ([string]::IsNullOrWhiteSpace($env:BACKUP_DIR)) { 'backups' } else { $env:BACKUP_DIR }
if (-not (Test-Path $backupDir)) {
  New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $backupDir "beca-$timestamp.dump"

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
  Write-Error 'pg_dump nao encontrado no PATH. Instale PostgreSQL client tools.'
}

Write-Host "Gerando backup em $target"
& pg_dump --format=custom --file "$target" "$dbUrl"

if ($LASTEXITCODE -ne 0) {
  Write-Error 'Falha ao gerar backup.'
}

Write-Host 'Backup concluido com sucesso.'
