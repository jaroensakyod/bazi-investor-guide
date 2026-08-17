import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeUserId } from "../chat/user-store";
import { validateDecisionProfile, type DecisionProfile } from "./decision-profile";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const DECISION_PROFILE_DIR = path.join(ROOT, "data/decision-profiles");

export function decisionProfileFile(profileId: string, root = DECISION_PROFILE_DIR): string {
  return path.join(root, sanitizeUserId(profileId) + ".json");
}

export function saveDecisionProfile(profile: DecisionProfile, root = DECISION_PROFILE_DIR): string {
  const problems = validateDecisionProfile(profile);
  if (problems.length > 0) throw new Error(problems.join("; "));
  mkdirSync(root, { recursive: true });
  const file = decisionProfileFile(profile.profileId, root);
  const temporary = file + "." + randomUUID() + ".tmp";
  writeFileSync(temporary, JSON.stringify(profile, null, 2) + "\n", "utf8");
  renameSync(temporary, file);
  return file;
}

export function loadDecisionProfile(profileId: string, root = DECISION_PROFILE_DIR): DecisionProfile | null {
  const file = decisionProfileFile(profileId, root);
  if (!existsSync(file)) return null;
  try {
    const profile = JSON.parse(readFileSync(file, "utf8")) as DecisionProfile;
    return validateDecisionProfile(profile).length === 0 ? profile : null;
  } catch {
    return null;
  }
}
