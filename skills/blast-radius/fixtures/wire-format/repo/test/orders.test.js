import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeOrder } from "../src/api/orders.js";
import { orderLine } from "../src/web/orderView.js";

test("serializeOrder returns three fields", () => {
  const o = serializeOrder({ id: 1, customerName: "Customer A", totalCents: 1250 });
  assert.equal(Object.keys(o).length, 3);
});

test("orderLine shows the amount with two decimals", () => {
  assert.equal(orderLine({ id: 2, customerName: "Customer B", totalCents: 399 }), "2 Customer B 3.99");
});
