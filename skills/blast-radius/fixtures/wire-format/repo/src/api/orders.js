// The JSON the /orders endpoint returns, one object per order.
export function serializeOrder(order) {
  return {
    id: order.id,
    customer: order.customerName,
    total: order.totalCents / 100,
  };
}
