export const initialProducts = [
  // MATÉRIAS PRIMAS
  {
    id: "ING-001",
    type: "ingrediente",
    name: "Farinha Especial Premium",
    sku: "FAR-01",
    unit: "kg",
    custo_producao: 4.50, // per kg
    lotes: [
        { loteId: "L-231101", qtd: 50.0, validade: "2024-05-10" },
        { loteId: "L-231105", qtd: 25.0, validade: "2024-05-20" }
    ]
  },
  {
    id: "ING-002",
    type: "ingrediente",
    name: "Chocolate Amargo Belgian",
    sku: "CHOC-02",
    unit: "kg",
    custo_producao: 42.00,
    lotes: [
        { loteId: "L-231015", qtd: 12.5, validade: "2024-02-15" }
    ]
  },
  {
    id: "EMB-001",
    type: "embalagem",
    name: "Caixa Rosa Veludo (12 unid)",
    sku: "CX-VLD-12",
    unit: "unidade",
    custo_producao: 3.20,
    lotes: [
        { loteId: "N/A", qtd: 350, validade: "2099-12-31" }
    ]
  },
  
  // PRODUTOS FINAIS
  {
    id: "PROD-CC_PREMIUM",
    type: "produto_final",
    name: "Caixa Cookies Choco Premium",
    sku: "CC-PREM-CX",
    unit: "caixas",
    lotes: [
        { loteId: "L-PR-1110", qtd: 15, validade: "2024-01-10" }
    ],
    // Ficha Técnica Automática
    receita: {
        rendimento: 10, // 1 fornada rende 10 caixas
        valor_venda_sugerido: 45.00, // Cada caixa é vendida a R$45
        ingredientes: [
            { id: "ING-001", nome: "Farinha Especial Premium", uso: 2.5, perda_pct: 2 }, // Usa 2.5kg + 2% de perda na bancada
            { id: "ING-002", nome: "Chocolate Amargo Belgian", uso: 1.2, perda_pct: 5 },
            { id: "EMB-001", nome: "Caixa Rosa Veludo (12 unid)", uso: 10, perda_pct: 0 } // Gasta 10 caixas
        ]
    }
  }
];

export const initialEquipments = [
  { id: "EQ-001", name: "Forno Industrial 1", type: "oven_gen", health: 75, status: "Normal" }
];

export const initialMetrics = {
  caixaRealizado: 34500.00
};

export const initialOrders = [
  {
    id: "ORD-001",
    cliente: "Biscoitaria Central Ltda",
    produtoFinalId: "PROD-CC_PREMIUM",
    quantidade: 200,
    status: "pendente",
    data: "2024-05-15T14:30:00.000Z",
    prazo: "2024-05-16",
    responsavel: "João Silva"
  },
  {
    id: "ORD-002",
    cliente: "Supermercado Ideal",
    produtoFinalId: "PROD-CC_PREMIUM",
    quantidade: 500,
    status: "logistica",
    data: "2024-05-14T09:00:00.000Z",
    prazo: "2024-05-15",
    responsavel: "Maria Costa"
  }
];
