# Guia de Treinamento e Uso

Este documento contém instruções completas para os módulos principais do sistema. Use-o como referência ou base para o material de treinamento presencial.

## Dashboard

Visão geral dos KPIs operacionais. Mostra vendas do dia, pedidos ativos, itens em baixo estoque e status dos fornos.

### Como usar

- Ao entrar, verifique os indicadores principais. Cada card pode ser clicado para acessar o módulo correspondente (Relatórios, Jornada, Estoque, Fornos).
- Garanta que os produtos e lotes estejam cadastrados antes de criar pedidos para que indicadores reflitam corretamente.

## Jornada / Pedidos

Aqui você cria e acompanha os pedidos de produção.

1. Criar pedido: Vá para Jornada e clique em "Novo pedido". Informe cliente, produto final e quantidade.
2. Avançar status: Use o menu de ações do pedido para mover entre `pendente` → `producao` → `logistica` → `concluido`.
3. Rastreamento: Cada avanço registra histórico; utilize Relatórios → Rastreabilidade para ver genealogia de lotes produzidos.

## Estoque (Produtos e Lotes)

Gerencie produtos, insumos e seus lotes.

- Cadastrar produto: Acesse Produtos/Estoque → Novo Produto. Preencha id, nome, tipo (ingrediente / produto_final / embalagem), unidade e receita (se for produto final).
- Adicionar lote: Em um produto, registre um lote com loteId, quantidade e validade. Lotes alimentam o estoque virtual e podem ser consumidos na produção.
- Inventário manual: Use Inventário → Contagem para ajustar quantidades (gera movimento de estoque auditable).

## Fornos / Equipamentos

Monitore a saúde e eventos dos equipamentos.

- Registrar equipamento: Acesse Fornos e adicione um equipamento com nome e tipo.
- Eventos: Registre eventos (ex.: início, fim, manutenção). Os eventos ajudam diagnóstico e KPIs.

## Expedição

Gerencie remoção de lotes e registro de expedição.

- Marcar pedido como expedido: Ao preparar remessa, avance pedido para status de logística e marque como expedido no histórico.
- Relatórios de expedição: Use filtros em Relatórios para extrair histórico por datas e pedidos.

## Inventário

Contagens físicas e ajustes.

1. Crie uma contagem física em Inventário.
2. Para cada lote encontre o registro e informe a quantidade real; o sistema cria movimentos que atualizam estoque e histórico.

## Relatórios e Rastreabilidade

Painel de indicadores e busca por lote ou pedido para ver genealogia.

- Buscar genealogia: Em Relatórios, insira o loteId (ex: LPR-...) ou o id interno do lote para ver os insumos usados e quantidades.
- Campos retornados: Parent Lot, Child Lot, Qty, Unit, Order e Timestamp.

## Acessos e Permissões

Gerencie membros do tenant e suas funções.

- Adicionar membro: Acesse Acessos e convide por e-mail; atribua função (admin, operacao, leitura).
- Funções controlam RLS — apenas membros do tenant correto veem dados do tenant.

## Fluxo de Rastreabilidade (exemplo prático)

1. Cadastrar insumos A e B (tipo ingrediente) com lotes disponíveis.
2. Cadastrar produto final P com receita que consome A e B.
3. Criar pedido para produto P (quantidade 1).
4. Avançar o pedido para produção — o sistema cria um lote filho para P e grava na tabela de genealogia as linhas com parent_lot_uuid (insumos) e child_lot_uuid (produto P).
5. Em Relatórios → Rastreabilidade, pesquise pelo lote (LPR-...) ou pelo id do lote para ver as linhas de genealogia.

## Atalhos e Recursos

- Para testar rapidamente: execute o script de seed (node scripts/e2e_create_user_seed_and_output.mjs) para criar um usuário de teste e um pedido de produção.
- Logs & troubleshooting: em caso de erro, abra DevTools e verifique console (mensagens de RLS, RPC ou React).
- Contato: adicione um e-mail ou link de suporte se necessário.
