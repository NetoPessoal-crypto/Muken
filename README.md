# BECA

Sistema operacional para pedidos, estoque, producao e logistica, com persistencia em Supabase.

## Setup

1. Instale dependencias:
   - `npm install`
2. Configure `.env.local` com:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Rode o app:
   - `npm run dev`

## Qualidade

- Lint: `npm run lint`
- Testes: `npm run test`
- E2E: `npm run test:e2e`
- Build: `npm run build`

## CI

Pipeline em `.github/workflows/ci.yml` executa:
- lint
- test
- build
- e2e smoke (Playwright)

## Migrações principais recentes

- `supabase/migrations/20260425150000_beca_transactional_ops.sql`
  - RPCs transacionais para pedido/status/movimentacao.
- `supabase/migrations/20260425183000_beca_operational_hardening.sql`
  - Ordem de producao (OP), etapas logisticas com conferencia/expedicao e hardening de auditoria.
- `supabase/migrations/20260425193000_beca_ops_actions_and_inventory.sql`
  - Acoes de OP (iniciar/finalizar/cancelar) e inventario ciclico com ajuste controlado.

## Passo 1 - Aplicar e validar no Supabase

1. Aplicar migrations no banco remoto.
2. Validar fluxos:
   - criar pedido
   - pendente -> producao -> logistica
   - separar -> conferir -> expedir -> concluir
   - cancelar com estorno (admin)
   - entrada/saida/ajuste/perda/devolucao de estoque

## Backup e restore (operacao)

Requer `pg_dump` e `pg_restore` no PATH e `SUPABASE_DB_URL` no ambiente.

- Backup: `npm run db:backup`
- Restore (ultimo backup): `npm run db:restore`
- Restore (arquivo especifico):
  - `powershell -ExecutionPolicy Bypass -File scripts/db-restore.ps1 -BackupFile "backups/seu-arquivo.dump"`

## Modulos operacionais novos

- `Fornos`: OP real com acoes operacionais.
- `Expedicao`: checklist obrigatorio separado -> conferido -> expedido -> concluido.
- `Inventario`: contagem fisica e ajuste auditado.

## Preflight de ambiente

- Local: `npm run preflight:local`
- Staging: `npm run preflight:staging`
- Production: `npm run preflight:production`

## Runbook

- Consulte `OPERACAO_RUNBOOK.md` para rotina diaria, backup/restore e resposta a incidentes.
