import { serializeOrder } from "../api/orders.js";

// One line of the orders page.
export function orderLine(order) {
  const o = serializeOrder(order);
  return `${o.id} ${o.customer} ${o.total.toFixed(2)}`;
}
