export function toCsv(rows: string[][]) { return rows.map((r) => r.join(",")).join("\n"); }
