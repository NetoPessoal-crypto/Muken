param(
  [string]$BackupFile = ''
)

$ErrorActionPreference = 'Stop'

$dbUrl = $env:SUPABASE_DB_URL
if ([string]::IsNullOrWhiteSpace($dbUrl)) {
  Write-Error 'SUPABASE_DB_URL nao definido. Ex: postgresql://user:pass@host:5432/postgres'
}

$backupDir = if ([string]::IsNullOrWhiteSpace($env:BACKUP_DIR)) { 'backups' } else { $env:BACKUP_DIR }

if ([string]::IsNullOrWhiteSpace($BackupFile)) {
  if (-not (Test-Path $backupDir)) {
    Write-Error "Diretorio de backup nao encontrado: $backupDir"
  }

  $latest = Get-ChildItem -Path $backupDir -Filter '*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) {
    Write-Error 'Nenhum arquivo .dump encontrado para restauracao.'
  }
  $BackupFile = $latest.FullName
}

if (-not (Test-Path $BackupFile)) {
  Write-Error "Arquivo de backup nao encontrado: $BackupFile"
}

$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $pgRestore) {
  Write-Error 'pg_restore nao encontrado no PATH. Instale PostgreSQL client tools.'
}

Write-Host "Restaurando backup: $BackupFile"
& pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$dbUrl" "$BackupFile"

if ($LASTEXITCODE -ne 0) {
  Write-Error 'Falha ao restaurar backup.'
}

Write-Host 'Restore concluido com sucesso.'
