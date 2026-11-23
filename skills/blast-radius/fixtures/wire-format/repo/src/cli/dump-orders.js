// Writes the day's orders as the endpoint serves them; the nightly job reads this file.
import { mkdirSync, writeFileSync } from "node:fs";
import { serializeOrder } from "../api/orders.js";
import { ORDERS } from "../data/sample-orders.js";

mkdirSync("out", { recursive: true });
writeFileSync("out/orders.json", JSON.stringify(ORDERS.map(serializeOrder), null, 2));
console.log(`wrote ${ORDERS.length} orders to out/orders.json`);
