import { readFileSync } from "node:fs";
import { loadSecurityEventFile, mergeSecurityEvents, saveSecurityEventFile } from "../src/lib/research/security-event-store";
import type { SecurityEvent } from "../src/lib/research/security-birth";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const inputFile = arg("file");
if (!inputFile) throw new Error("ต้องระบุ --file=C:\\path\\verified-security-events.json");
const parsed = JSON.parse(readFileSync(inputFile, "utf8")) as SecurityEvent[] | { events?: SecurityEvent[] };
const incoming = Array.isArray(parsed) ? parsed : parsed.events;
if (!incoming || !Array.isArray(incoming)) throw new Error("ไฟล์ต้องเป็น SecurityEvent[] หรือ { events: SecurityEvent[] }");

const current = loadSecurityEventFile();
const merged = mergeSecurityEvents(current.events, incoming);
const saved = saveSecurityEventFile(merged);
console.log(JSON.stringify({ imported: incoming.length, total: saved.events.length, updatedAt: saved.updatedAt }, null, 2));

