export function toNonNegativeAmount(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function sumAmounts(items = []) {
  return items.reduce((sum, item) => sum + toNonNegativeAmount(item?.amount), 0);
}

export function getFinancialMetrics(finance = {}) {
  const moveCosts = sumAmounts(finance.moveExpenses);
  const monthlyCosts = sumAmounts(finance.monthlyExpenses);
  const availableByMove = toNonNegativeAmount(finance.currentSavings)
    + toNonNegativeAmount(finance.expectedIncome);
  const remainingAfterMove = availableByMove - moveCosts;

  return {
    moveCosts,
    monthlyCosts,
    availableByMove,
    remainingAfterMove,
    runway: monthlyCosts > 0 ? Math.max(0, remainingAfterMove) / monthlyCosts : null,
  };
}
