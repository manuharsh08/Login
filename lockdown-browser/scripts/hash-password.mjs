/** Prints the SHA-256 to paste into quitPasswordHash. Usage: npm run hash-password -- "secret" */
import { createHash } from "node:crypto";
import process from "node:process";

const password = process.argv[2];
if (!password) {
  console.error('\n  Usage: npm run hash-password -- "your password"\n');
  process.exit(1);
}

console.log(`\n  quitPasswordHash: "${createHash("sha256").update(password, "utf8").digest("hex")}"\n`);
