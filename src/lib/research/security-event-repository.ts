import securityEventsData from "@/../data/security-events.json";
import {
  SECURITY_EVENT_SCHEMA_VERSION,
  resolveSecurityBirth,
  securityIdOf,
  type SecurityBirthResolution,
  type SecurityEvent,
} from "./security-birth";

type SecurityEventFile = {
  schemaVersion: number;
  updatedAt: string | null;
  events: SecurityEvent[];
};

function fileData(): SecurityEventFile {
  return securityEventsData as unknown as SecurityEventFile;
}

export function getSecurityEvents(securityId?: string): SecurityEvent[] {
  const data = fileData();
  if (data.schemaVersion !== SECURITY_EVENT_SCHEMA_VERSION) {
    throw new Error(`security-events schema ${data.schemaVersion} ไม่รองรับ`);
  }
  return securityId ? data.events.filter((event) => event.securityId === securityId) : [...data.events];
}

export function getSecurityBirth(market: string, ticker: string): SecurityBirthResolution {
  const securityId = securityIdOf(market, ticker);
  return resolveSecurityBirth(securityId, getSecurityEvents(securityId));
}

export function getSecurityEventFileStatus(): { schemaVersion: number; updatedAt: string | null; eventCount: number } {
  const data = fileData();
  return { schemaVersion: data.schemaVersion, updatedAt: data.updatedAt, eventCount: data.events.length };
}
