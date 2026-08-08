export type RiskBand = "ระวังสูง" | "สมดุล" | "รับความผันผวนได้";

export type FinancialInputSource = "demo" | "provided" | "server";

export type FinancialInputs = {
  capital: number;
  monthlyIncome: number;
  monthlyExpense: number;
  emergencySavings: number;
  emergencyMonths: number;
  debtBalance: number;
  debtApr: number;
  monthly: number;
  horizonYears: number;
  maxDrawdown: number;
  goal: string;
  goalAmount: number;
  currentGoalSavings: number;
  goalYears: number;
  currentEquityPct: number;
  currentBondPct: number;
  currentCashPct: number;
  source: FinancialInputSource;
  isDemo: boolean;
};

export type Allocation = {
  equity: number;
  bond: number;
  cash: number;
};

export type GoalScenario = {
  annualReturn: number;
  requiredMonthly: number;
  label: string;
};

export type StressScenario = {
  label: string;
  marketDrop: number;
  estimatedLoss: number;
  postStressCapital: number;
  action: string;
};

export type FinancialSnapshot = {
  monthlySurplus: number;
  surplusRate: number;
  emergencyTarget: number;
  emergencyGap: number;
  runwayMonths: number;
  investableMonthly: number;
  highInterestDebt: boolean;
  willingness: RiskBand;
  capacity: RiskBand;
  effectiveRisk: RiskBand;
  allocationModel: {
    name: string;
    allocation: Allocation;
    reason: string;
  };
  currentAllocation: Allocation;
  allocationDrift: Allocation;
  goalGap: number;
  goalScenarios: GoalScenario[];
  goalStatus: "พร้อมเดินตามแผน" | "ต้องเพิ่มเงินหรือเวลา" | "ต้องซ่อมฐานก่อน";
  stressScenarios: StressScenario[];
  incomeShock: Array<{ months: number; remainingEmergency: number; status: string }>;
  alerts: string[];
  confidence: "ตัวอย่าง" | "ปานกลาง" | "สูง";
};

export const FINANCIAL_PRESETS: Record<"starter" | "builder" | "established", FinancialInputs> = {
  starter: {
    capital: 80_000,
    monthlyIncome: 35_000,
    monthlyExpense: 28_000,
    emergencySavings: 35_000,
    emergencyMonths: 6,
    debtBalance: 40_000,
    debtApr: 18,
    monthly: 3_000,
    horizonYears: 5,
    maxDrawdown: 10,
    goal: "สร้างเงินก้อนแรกโดยไม่เพิ่มหนี้",
    goalAmount: 500_000,
    currentGoalSavings: 80_000,
    goalYears: 5,
    currentEquityPct: 70,
    currentBondPct: 0,
    currentCashPct: 30,
    source: "demo",
    isDemo: true,
  },
  builder: {
    capital: 500_000,
    monthlyIncome: 70_000,
    monthlyExpense: 30_000,
    emergencySavings: 180_000,
    emergencyMonths: 6,
    debtBalance: 0,
    debtApr: 0,
    monthly: 20_000,
    horizonYears: 10,
    maxDrawdown: 20,
    goal: "สร้างพอร์ตระยะยาวและรักษาสภาพคล่อง",
    goalAmount: 2_000_000,
    currentGoalSavings: 500_000,
    goalYears: 10,
    currentEquityPct: 80,
    currentBondPct: 5,
    currentCashPct: 15,
    source: "demo",
    isDemo: true,
  },
  established: {
    capital: 2_500_000,
    monthlyIncome: 150_000,
    monthlyExpense: 70_000,
    emergencySavings: 600_000,
    emergencyMonths: 8,
    debtBalance: 800_000,
    debtApr: 5.5,
    monthly: 50_000,
    horizonYears: 12,
    maxDrawdown: 30,
    goal: "ขยายพอร์ตพร้อมรักษาความมั่นคงของครอบครัว",
    goalAmount: 8_000_000,
    currentGoalSavings: 2_500_000,
    goalYears: 12,
    currentEquityPct: 65,
    currentBondPct: 15,
    currentCashPct: 20,
    source: "demo",
    isDemo: true,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function riskRank(band: RiskBand): number {
  return band === "ระวังสูง" ? 0 : band === "สมดุล" ? 1 : 2;
}

function lowerRisk(a: RiskBand, b: RiskBand): RiskBand {
  return riskRank(a) <= riskRank(b) ? a : b;
}

function willingnessFromDrawdown(maxDrawdown: number): RiskBand {
  if (maxDrawdown <= 12) return "ระวังสูง";
  if (maxDrawdown <= 25) return "สมดุล";
  return "รับความผันผวนได้";
}

function capacityFromFacts(input: FinancialInputs, runwayMonths: number, monthlySurplus: number): RiskBand {
  let score = 0;
  if (runwayMonths >= input.emergencyMonths) score += 2;
  else if (runwayMonths >= 3) score += 1;
  else score -= 2;
  if (input.horizonYears >= 10) score += 2;
  else if (input.horizonYears >= 5) score += 1;
  else score -= 1;
  if (monthlySurplus > 0) score += 1;
  else score -= 2;
  if (input.debtApr >= 12 && input.debtBalance > 0) score -= 3;
  else if (input.debtBalance > input.capital) score -= 1;
  if (score <= 0) return "ระวังสูง";
  if (score <= 3) return "สมดุล";
  return "รับความผันผวนได้";
}

function allocationForRisk(risk: RiskBand): FinancialSnapshot["allocationModel"] {
  if (risk === "ระวังสูง") {
    return {
      name: "รักษาฐานก่อนขยาย",
      allocation: { equity: 40, bond: 30, cash: 30 },
      reason: "สภาพคล่องและความเสียหายที่รับได้สำคัญกว่าความเร็วของผลตอบแทน",
    };
  }
  if (risk === "สมดุล") {
    return {
      name: "เติบโตอย่างมีเขื่อน",
      allocation: { equity: 60, bond: 25, cash: 15 },
      reason: "มีเวลาสร้างผลตอบแทน แต่ยังต้องมีสินทรัพย์กันแรงและเงินพร้อมใช้",
    };
  }
  return {
    name: "ขยายกำลังอย่างมีเพดาน",
    allocation: { equity: 75, bond: 15, cash: 10 },
    reason: "ฐานการเงินและระยะเวลารองรับความผันผวนได้ แต่ยังต้องมีกฎลดขนาด",
  };
}

function normalizedAllocation(input: FinancialInputs): Allocation {
  const total = input.currentEquityPct + input.currentBondPct + input.currentCashPct;
  if (total <= 0) return { equity: 0, bond: 0, cash: 100 };
  return {
    equity: Math.round((input.currentEquityPct / total) * 100),
    bond: Math.round((input.currentBondPct / total) * 100),
    cash: Math.round((input.currentCashPct / total) * 100),
  };
}

function requiredMonthlyForGoal(target: number, current: number, years: number, annualReturn: number): number {
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualReturn / 100 / 12;
  const futureCurrent = current * Math.pow(1 + monthlyRate, months);
  const gap = Math.max(0, target - futureCurrent);
  if (gap === 0) return 0;
  if (monthlyRate === 0) return gap / months;
  return gap * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
}

export function buildFinancialSnapshot(rawInput: FinancialInputs): FinancialSnapshot {
  const input: FinancialInputs = {
    ...rawInput,
    capital: finiteNonNegative(rawInput.capital),
    monthlyIncome: finiteNonNegative(rawInput.monthlyIncome),
    monthlyExpense: finiteNonNegative(rawInput.monthlyExpense),
    emergencySavings: finiteNonNegative(rawInput.emergencySavings),
    debtBalance: finiteNonNegative(rawInput.debtBalance),
    debtApr: clamp(finiteNonNegative(rawInput.debtApr), 0, 100),
    monthly: finiteNonNegative(rawInput.monthly),
    horizonYears: clamp(finiteNonNegative(rawInput.horizonYears), 1, 60),
    maxDrawdown: clamp(finiteNonNegative(rawInput.maxDrawdown), 0, 100),
    goalAmount: finiteNonNegative(rawInput.goalAmount),
    currentGoalSavings: finiteNonNegative(rawInput.currentGoalSavings),
    goalYears: clamp(finiteNonNegative(rawInput.goalYears), 1, 60),
  };
  const monthlySurplus = input.monthlyIncome - input.monthlyExpense;
  const surplusRate = input.monthlyIncome > 0 ? monthlySurplus / input.monthlyIncome * 100 : 0;
  const emergencyTarget = input.monthlyExpense * input.emergencyMonths;
  const emergencyGap = Math.max(0, emergencyTarget - input.emergencySavings);
  const runwayMonths = input.monthlyExpense > 0 ? input.emergencySavings / input.monthlyExpense : 0;
  const investableMonthly = Math.max(0, Math.min(input.monthly, monthlySurplus));
  const highInterestDebt = input.debtBalance > 0 && input.debtApr >= 12;
  const willingness = willingnessFromDrawdown(input.maxDrawdown);
  const capacity = capacityFromFacts(input, runwayMonths, monthlySurplus);
  const effectiveRisk = lowerRisk(willingness, capacity);
  const allocationModel = allocationForRisk(effectiveRisk);
  const currentAllocation = normalizedAllocation(input);
  const allocationDrift = {
    equity: currentAllocation.equity - allocationModel.allocation.equity,
    bond: currentAllocation.bond - allocationModel.allocation.bond,
    cash: currentAllocation.cash - allocationModel.allocation.cash,
  };
  const goalGap = Math.max(0, input.goalAmount - input.currentGoalSavings);
  const goalScenarios: GoalScenario[] = [
    { annualReturn: 2, label: "อนุรักษ์นิยม", requiredMonthly: requiredMonthlyForGoal(input.goalAmount, input.currentGoalSavings, input.goalYears, 2) },
    { annualReturn: 5, label: "ฐานกลาง", requiredMonthly: requiredMonthlyForGoal(input.goalAmount, input.currentGoalSavings, input.goalYears, 5) },
    { annualReturn: 8, label: "เติบโต", requiredMonthly: requiredMonthlyForGoal(input.goalAmount, input.currentGoalSavings, input.goalYears, 8) },
  ];
  const baseRequired = goalScenarios[1].requiredMonthly;
  const goalStatus: FinancialSnapshot["goalStatus"] = highInterestDebt || runwayMonths < 3
    ? "ต้องซ่อมฐานก่อน"
    : investableMonthly >= baseRequired
      ? "พร้อมเดินตามแผน"
      : "ต้องเพิ่มเงินหรือเวลา";
  const stressScenarios: StressScenario[] = [10, 20, 35].map((drop) => {
    const estimatedLoss = input.capital * (allocationModel.allocation.equity / 100) * (drop / 100);
    return {
      label: `ตลาดหุ้นลดลง ${drop}%`,
      marketDrop: drop,
      estimatedLoss,
      postStressCapital: Math.max(0, input.capital - estimatedLoss),
      action: drop >= 35 ? "หยุดเพิ่มเงิน ตรวจ runway และทบทวน thesis ทุกตัว" : drop >= 20 ? "เทียบ drift กับ IPS ก่อน rebalance" : "ไม่เปลี่ยนแผนจากราคาเพียงอย่างเดียว",
    };
  });
  const incomeShock = [3, 6].map((months) => {
    const remainingEmergency = input.emergencySavings - input.monthlyExpense * months;
    return {
      months,
      remainingEmergency,
      status: remainingEmergency >= 0 ? "ยังมีเงินสำรองรองรับ" : `ขาดอีก ${Math.abs(remainingEmergency).toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`,
    };
  });
  const alerts: string[] = [];
  if (runwayMonths < input.emergencyMonths) alerts.push(`เงินสำรองต่ำกว่าเป้าหมาย ${input.emergencyMonths} เดือน`);
  if (highInterestDebt) alerts.push(`หนี้ดอกเบี้ย ${input.debtApr}% ควรได้รับการจัดลำดับก่อนเพิ่มความเสี่ยง`);
  if (input.monthly > monthlySurplus) alerts.push("เงินที่ตั้งใจลงทุนสูงกว่าเงินเหลือจริงต่อเดือน");
  if (Math.abs(allocationDrift.equity) >= 15) alerts.push(`น้ำหนักหุ้นเบี่ยงจากกรอบ ${Math.abs(allocationDrift.equity)} จุดเปอร์เซ็นต์`);
  if (!alerts.length) alerts.push("ยังไม่พบข้อจำกัดเร่งด่วนจากข้อมูลชุดนี้ แต่ต้องทบทวนเมื่อรายรับหรือเป้าหมายเปลี่ยน");

  return {
    monthlySurplus,
    surplusRate,
    emergencyTarget,
    emergencyGap,
    runwayMonths,
    investableMonthly,
    highInterestDebt,
    willingness,
    capacity,
    effectiveRisk,
    allocationModel,
    currentAllocation,
    allocationDrift,
    goalGap,
    goalScenarios,
    goalStatus,
    stressScenarios,
    incomeShock,
    alerts,
    confidence: input.isDemo ? "ตัวอย่าง" : input.source === "server" ? "สูง" : "ปานกลาง",
  };
}
