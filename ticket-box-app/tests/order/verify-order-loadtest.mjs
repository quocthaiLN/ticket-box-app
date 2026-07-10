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
  const oversoldRows = rawOutput
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [ticketType, totalQuantity, heldQuantity] = line.split("\t");

      return {
        ticketType,
        totalQuantity: Number(totalQuantity.trim()),
        heldQuantity: Number(heldQuantity.trim()),
      };
    })
    .filter((row) => row.heldQuantity > row.totalQuantity);

  if (oversoldRows.length > 0) {
    console.error("FAIL: oversell detected.");
    console.table(oversoldRows);
    process.exit(1);
  }

  console.log("PASS: held quantity does not exceed total quantity.");
} catch (error) {
  console.error("FAIL: unable to verify order load test inventory.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}
