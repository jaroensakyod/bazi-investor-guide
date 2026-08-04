/**
 * In-memory stub ของ BaziKnowledgeRepository — ใช้กับ calculateBaziChart
 * เพื่อให้ engine รันได้โดยไม่ต้องพึ่ง DB (Neon/Postgres)
 *
 * ข้อมูลเสริม (persona/solar terms/domain matrix) คืนค่า null/[] — โค้ด engine
 * รองรับการ fallback อยู่แล้ว (persona?. / ?? [])
 */
import type {
  BaziKnowledgeRepository,
  SolarTermBoundaryContext,
} from "@/lib/bazi/symbolic-engine.types";

export function createInMemoryKnowledgeRepository(): BaziKnowledgeRepository {
  return {
    async findSolarTermBoundaryContext(): Promise<SolarTermBoundaryContext> {
      // โค้ด engine อ่าน solarTerms.previous/.next ตรง ๆ → ต้องคืน object (null ได้ใน field)
      return { previous: null, next: null };
    },
    async findDayMasterStrengthProfile(): Promise<null> {
      return null;
    },
    async findSixtyJiaziPersona(): Promise<null> {
      return null;
    },
    async findDomainMatrixRows(): Promise<never[]> {
      return [];
    },
  };
}
