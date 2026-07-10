import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const POSTGRES_CONTAINER = process.env.POSTGRES_CONTAINER ?? "ticketbox-postgres";
const POSTGRES_USER = process.env.POSTGRES_USER ?? "ticketbox";
const POSTGRES_DB = process.env.POSTGRES_DB ?? "ticketbox";
const SQL_FILE = new URL("./order-inventory-check.sql", import.meta.url);

function runPsql(args, sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec",
      "-i",
      POSTGRES_CONTAINER,
      "psql",
      "-U",
      POSTGRES_USER,
      "-d",
      POSTGRES_DB,
      "-v",
      "ON_ERROR_STOP=1",
      ...args,
    ]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim()));
    });

    child.stdin.end(sql);
  });
}

try {
  const sql = await readFile(SQL_FILE, "utf8");
  const tableOutput = await runPsql([], sql);

  console.log(tableOutput);

  const rawOutput = await runPsql(["-t", "-A", "-F", "\t"], sql);
  const inventoryRows = rawOutput
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [
        ticketType,
        totalQuantity,
        inventoryHeldQuantity,
        soldQuantity,
        heldOrderItemQuantity,
        ledgerGap,
        heldOrdersWithoutItems,
      ] = line.split("\t");

      return {
        ticketType,
        totalQuantity: Number(totalQuantity.trim()),
        inventoryHeldQuantity: Number(inventoryHeldQuantity.trim()),
        soldQuantity: Number(soldQuantity.trim()),
        heldOrderItemQuantity: Number(heldOrderItemQuantity.trim()),
        ledgerGap: Number(ledgerGap.trim()),
        heldOrdersWithoutItems: Number(heldOrdersWithoutItems.trim()),
      };
    });

  const invalidRows = inventoryRows.filter(
    (row) =>
      row.inventoryHeldQuantity + row.soldQuantity > row.totalQuantity ||
      row.ledgerGap !== 0 ||
      row.heldOrdersWithoutItems !== 0,
  );

  if (invalidRows.length > 0) {
    console.error("FAIL: order inventory invariant violated.");
    console.table(invalidRows);
    process.exit(1);
  }

  console.log("PASS: physical inventory and HELD-order ledger are consistent.");
} catch (error) {
  console.error("FAIL: unable to verify order load test inventory.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}
