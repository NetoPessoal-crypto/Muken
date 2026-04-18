/**
 * Smart Parser — Robusto e independente de cabeçalhos exatos
 *
 * Lógica:
 * - Linhas que contêm "R$" e "por" → masterData (preco base do insumo)
 * - Linhas que NÃO contêm "R$" mas contêm ":" com número → recipeData (medidas de uso)
 * - Linhas de cabeçalho (sem número) são ignoradas
 */

export const parseSmartText = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);

  const masterData = [];
  const recipeData = [];

  lines.forEach(line => {
    // Linha de preço: deve ter R$ e "por"
    if (/R\$/i.test(line) && /\bpor\b/i.test(line)) {
      // Formato: "Nome do Item: R$ XX,XX por unidade"
      const regex = /^(.+?):\s*R\$\s*([\d.,]+)\s*por\s*(.+)/i;
      const match = line.match(regex);
      if (match) {
        const rawUnit = match[3].trim().replace(/\s*\(.*?\)/g, '').toLowerCase();
        masterData.push({
          name: match[1].trim(),
          price: parseFloat(match[2].replace(/\./g, '').replace(',', '.')) || 0,
          unit: rawUnit
        });
      }
      return; // Skip to next line
    }

    // Linha de medida: deve ter ":" e um número, mas sem "R$"
    if (/:\s*[\d.,]+/.test(line) && !/R\$/i.test(line)) {
      // Formato: "Nome do Item: 200 g" ou "Nome: 2 un"
      const regex = /^(.+?):\s*([\d.,]+)\s*([a-zA-ZáàâãéèêíîóôõúûçÁÀÂÃÉÈÊÍÎÓÔÕÚÛÇ]+)?/i;
      const match = line.match(regex);
      if (match) {
        recipeData.push({
          name: match[1].trim(),
          amount: parseFloat(match[2].replace(',', '.')) || 0,
          unit: (match[3] || 'un').trim().toLowerCase()
        });
      }
    }
    // Linhas sem número (cabeçalhos) são ignoradas automaticamente
  });

  return { masterData, recipeData };
};

/**
 * Busca aproximada (Fuzzy Match)
 */
export const findBestMatch = (inputName, existingIngredients) => {
  if (!inputName || !existingIngredients?.length) return null;

  const normalize = str =>
    str.toLowerCase()
       .normalize('NFD')
       .replace(/[\u0300-\u036f]/g, '')
       .trim();

  const normalizedInput = normalize(inputName);
  let bestMatch = null;
  let highestScore = 0;

  existingIngredients.forEach(ing => {
    const normalizedTarget = normalize(ing.name);
    let score = 0;

    if (normalizedTarget === normalizedInput) {
      score = 1.0;
    } else if (normalizedTarget.includes(normalizedInput) || normalizedInput.includes(normalizedTarget)) {
      score = 0.75;
    } else {
      const inputWords = normalizedInput.split(/\s+/).filter(w => w.length > 2);
      const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 2);
      const intersection = inputWords.filter(w => targetWords.includes(w));
      if (inputWords.length > 0) {
        score = intersection.length / Math.max(inputWords.length, targetWords.length);
      }
    }

    if (score > highestScore && score > 0.4) {
      highestScore = score;
      bestMatch = ing;
    }
  });

  return highestScore > 0.5 ? bestMatch : null;
};
