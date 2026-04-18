# Runbook Operacional BECA

## Checklist diário

1. Verificar alertas em `Dashboard` (ruptura, expedição pendente, OP estagnada).
2. Verificar `Fornos` para OPs em produção e finalizar quando pronto.
3. Verificar `Expedição` e garantir fluxo separado -> conferido -> expedido.
4. Executar inventário cíclico dos itens críticos em `Inventário`.

## Rotina de backup

Pré-requisito: `SUPABASE_DB_URL` configurado e `pg_dump` no PATH.

- Executar backup: `npm run db:backup`
- Guardar arquivo `.dump` em storage seguro.

## Rotina de restore (incidente)

Pré-requisito: `SUPABASE_DB_URL` configurado e `pg_restore` no PATH.

- Restore do último backup: `npm run db:restore`
- Restore de arquivo específico:
  - `powershell -ExecutionPolicy Bypass -File scripts/db-restore.ps1 -BackupFile "backups/arquivo.dump"`

## Incidente crítico (fluxo)

1. Bloquear novas operações de expedição.
2. Exportar evidências (pedido, lote, movimentos e auditoria).
3. Restaurar último backup válido, se necessário.
4. Revalidar fluxo crítico: pedido -> produção -> logística -> conclusão.

## Pré-deploy

1. `npm run preflight:staging`
2. `npm run lint`
3. `npm run test`
4. `npm run test:e2e`
5. `npm run build`
