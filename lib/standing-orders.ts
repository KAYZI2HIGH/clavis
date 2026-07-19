import type { StandingOrder, StandingOrderCondition, Transaction } from "./types";

export function evaluateCondition(condition: StandingOrderCondition, tx: Partial<Transaction>): boolean {
  switch (condition.field) {
    case "amount": {
      const amount = tx.amount_kobo ?? 0;
      // In the UI we pass Naira values, convert to kobo for evaluation
      const value = Number(condition.value) * 100;
      
      switch (condition.comparator) {
        case "less_than": return amount < value;
        case "greater_than": return amount > value;
        case "equals": return amount === value;
        case "between": 
          if (condition.value2 === undefined) return false;
          return amount >= value && amount <= (Number(condition.value2) * 100);
        default: return false;
      }
    }
    case "recipient": {
      const recipient = String(tx.recipient_account || "").trim().toLowerCase();
      const value = String(condition.value).trim().toLowerCase();
      
      switch (condition.comparator) {
        case "equals": return recipient === value;
        default: return false;
      }
    }
    case "day_of_month": {
      const day = new Date().getDate();
      const value = Number(condition.value);
      
      switch (condition.comparator) {
        case "equals": return day === value;
        case "less_than": return day < value;
        case "greater_than": return day > value;
        default: return false;
      }
    }
    default:
      return false;
  }
}

/**
 * Evaluates a transaction against a list of standing orders and returns the best match.
 * The best match is defined as the matched order with the highest number of conditions (specificity).
 */
export function matchStandingOrder(orders: StandingOrder[], tx: Partial<Transaction>): StandingOrder | null {
  const activeOrders = orders.filter(o => o.status === "active");
  
  const matches = activeOrders.filter(order => {
    if (!order.conditions || order.conditions.length === 0) return false;
    return order.conditions.every(cond => evaluateCondition(cond, tx));
  });
  
  if (matches.length === 0) return null;
  
  // Sort by specificity (number of conditions descending)
  matches.sort((a, b) => b.conditions.length - a.conditions.length);
  
  return matches[0];
}
