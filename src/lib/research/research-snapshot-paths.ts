import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const RESEARCH_SNAPSHOT_DIR = path.join(ROOT, "data/cache/research-snapshots");
