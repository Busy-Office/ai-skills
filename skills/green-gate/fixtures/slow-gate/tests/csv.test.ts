import { toCsv } from "../src/export/csv";
test("csv", () => { expect(toCsv([["a"]])).toBe("a"); });
