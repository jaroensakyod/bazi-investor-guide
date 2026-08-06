/**
 * เนื้อหา policy (ข้อจำกัด/ความเสี่ยง/เงื่อนไข/ความเป็นส่วนตัว) — 3 ภาษา
 * แยกจาก i18n dictionary (dictionary = ป้ายสั้น, นี้ = เนื้อหายาว)
 * เขียนให้ตรงสไตล์ compliance ก.ล.ต. ของโปรเจค (ตีกรอบ "ไม่ใช่คำแนะนำการลงทุน")
 */

export type LegalBlock = { h: string; p: string[] };
export type LegalSection = Record<"th" | "zh" | "en", LegalBlock[]>;

export const LEGAL: Record<"disclaimer" | "risk" | "terms" | "privacy", LegalSection> = {
  disclaimer: {
    th: [
      { h: "ข้อจำกัดความรับผิดชอบ", p: [
        "ข้อมูลและบทวิเคราะห์ในเว็บไซต์ดวงนักลงทุน (รวมถึงผลลัพธ์จากแชท AI, พอร์ตเด่นรายเดือน, รายงานหุ้น, และการวิเคราะห์สินทรัพย์) จัดทำขึ้นเพื่อให้ข้อมูลทั่วไปและเพื่อความบันเทิงทางโหราศาสตร์เท่านั้น ไม่ใช่คำแนะนำทางการเงิน กฎหมาย ภาษี หรือการบัญชี",
        "เนื้อหาทั้งหมดอ้างอิงจากหลักโหราศาสตร์จีน (บาจื่อ/ธาตุทั้งห้า) ร่วมกับข้อมูลตลาด ข่าว และแนวโน้ม — ซึ่งเป็นความเชื่อทางวัฒนธรรม ไม่ได้การันตีผลลัพธ์ และไม่ถือเป็นคำแนะนำในการซื้อหรือขายหุ้นหรือเครื่องมือทางการเงินใด ๆ",
        "ผลการวิเคราะห์ของเราอาจไม่ตรงกับความคิดเห็นของทีมงาน และเราไม่รับผิดชอบต่อผลลัพธ์ของการลงทุนใด ๆ ที่อ้างอิงจากข้อมูลในเว็บไซต์นี้ ผู้ใช้เป็นผู้รับผิดชอบการตัดสินใจลงทุนของตนเองแต่เพียงผู้เดียว",
        "ผลการดำเนินงานในอดีต (รวมถึงพอร์ตเด่นรายเดือนก่อนหน้า) ไม่ได้บ่งชี้หรือรับประกันผลลัพธ์ในอนาคต การลงทุนมีความเสี่ยง ผู้ลงทุนอาจสูญเสียเงินต้นทั้งหมดได้",
      ]},
    ],
    zh: [
      { h: "免责声明", p: [
        "本网站（ดวงนักลงทุน / 命理投资）提供的信息和分析（包括 AI 聊天、月度精选组合、股票报告及资产分析）仅供一般参考和娱乐用途，不构成财务、法律、税务或会计建议。",
        "所有内容基于中国命理（八字/五行）结合市场数据、新闻和趋势——属于文化信仰，不保证结果，也不构成买入或卖出任何股票或金融工具的建议。",
        "我们的分析可能不代表团队观点，对基于本网站信息做出的任何投资结果不承担责任。用户须自行承担全部投资决策责任。",
        "过往表现（包括以往的月度精选组合）不预示也不保证未来结果。投资有风险，投资者可能损失全部本金。",
      ]},
    ],
    en: [
      { h: "Disclaimer", p: [
        "The information and analysis on this website (including AI chat, monthly picks, stock reports and asset analysis) is provided for general information and entertainment purposes only, and does not constitute financial, legal, tax or accounting advice.",
        "All content is based on Chinese astrology (Bazi/Five Elements) combined with market data, news and trends — a cultural belief that does not guarantee results and does not constitute a recommendation to buy or sell any stock or financial instrument.",
        "Our analysis may not reflect the views of the team, and we accept no responsibility for any investment outcomes based on information on this website. Users are solely responsible for their own investment decisions.",
        "Past performance (including previous monthly picks) does not indicate or guarantee future results. Investing involves risk; investors may lose their entire principal.",
      ]},
    ],
  },

  risk: {
    th: [
      { h: "การเปิดเผยความเสี่ยง", p: [
        "การลงทุนในเครื่องมือทางการเงินและ/หรือสกุลเงินดิจิทัลมีความเสี่ยงสูง รวมถึงการสูญเสียเงินลงทุนทั้งหมด ราคามีความผันผวนและอาจได้รับผลกระทบจากเหตุการณ์ทางเศรษฐกิจ กฎหมาย หรือการเมือง รวมถึงการลงทุนในต่างประเทศที่มีความเสี่ยงจากอัตราแลกเปลี่ยน",
        "การซื้อขายโดยใช้มาร์จิ้น (เลเวอเรจ) เช่น ฟิวเจอร์ส/อนุพันธ์ จะเพิ่มความเสี่ยงทางการเงินอย่างมาก ผู้ที่ไม่มีประสบการณ์ไม่ควรใช้เครื่องมือเหล่านี้",
        "ข้อมูลราคาบนเว็บไซต์อาจไม่ใช่ข้อมูลเรียลไทม์ อาจล่าช้า หรือไม่ถูกต้อง ราคาที่แสดงไม่จำเป็นต้องมาจากตลาดจริง และไม่ควรใช้เพื่อการซื้อขายจริง",
        "การวิเคราะห์ตามหลักดวง (บาจื่อ/ธาตุ) เป็นความเชื่อทางวัฒนธรรม ใช้เพื่อประกอบการพิจารณาเท่านั้น — ไม่ใช่ปัจจัยชี้ขาด และไม่ควรใช้เป็นเหตุผลเดียวในการลงทุน",
        "เราและผู้ให้บริการข้อมูลไม่รับผิดชอบต่อความเสียหายหรือการสูญเสียใด ๆ ที่เกิดจากการใช้ข้อมูลนี้",
      ]},
    ],
    zh: [
      { h: "风险提示", p: [
        "投资金融工具和/或加密货币具有高风险，包括损失全部投资本金。价格波动剧烈，可能受经济、法律或政治事件影响；跨境投资还面临汇率风险。",
        "使用保证金（杠杆）交易（如期货/衍生品）会大幅增加财务风险，缺乏经验者不应使用此类工具。",
        "本网站价格数据可能并非实时、可能延迟或不准确，所示价格不一定来自真实市场，不应作为实际交易依据。",
        "命理（八字/五行）分析属于文化信仰，仅供参考——不是决定因素，也不应作为投资的唯一依据。",
        "我们及数据提供商对因使用本信息造成的任何损害或损失不承担责任。",
      ]},
    ],
    en: [
      { h: "Risk Warning", p: [
        "Trading financial instruments and/or cryptocurrencies involves a high level of risk, including the loss of your entire investment. Prices are volatile and may be affected by economic, legal or political events; cross-border investing also carries currency risk.",
        "Margin (leveraged) trading such as futures/derivatives substantially increases financial risk and should not be used by inexperienced investors.",
        "Price data on this website may not be real-time, may be delayed or inaccurate. Prices shown do not necessarily come from actual markets and should not be used for live trading.",
        "Astrology-based (Bazi/Five Elements) analysis is a cultural belief for consideration only — it is not a decisive factor and should not be the sole basis for any investment.",
        "We and our data providers accept no liability for any damages or losses arising from the use of this information.",
      ]},
    ],
  },

  terms: {
    th: [
      { h: "ข้อกำหนดและเงื่อนไข", p: [
        "การเข้าใช้เว็บไซต์ดวงนักลงทุน ถือว่าผู้ใช้ยอมรับข้อกำหนดและเงื่อนไขทั้งหมดนี้ หากไม่เห็นด้วย กรุณาหยุดใช้บริการ",
        "เว็บไซต์นี้จัดทำขึ้นเพื่อใช้ส่วนตัวของผู้ใช้ในการประกอบการตัดสินใจด้านการลงทุนร่วมกับข้อมูลอื่น ๆ — ห้ามคัดลอก ทำซ้ำ ดัดแปลง เผยแพร่ หรือแจกจ่ายเนื้อหา (รวมถึงฐานข้อมูลหุ้น/สินทรัพย์ บทวิเคราะห์ และผลลัพธ์ AI) เพื่อการค้าโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร",
        "ผู้ใช้ต้องไม่ใช้ระบบในทางที่ผิด เช่น การยิงคำขอมากเกินไป การพยายามเข้าถึงข้อมูลของผู้อื่น หรือการขัดขวางการให้บริการ",
        "เราอาจปรับปรุงข้อกำหนดนี้เป็นครั้งคราว โดยประกาศบนเว็บไซต์ — การใช้งานต่อถือว่ายอมรับเวอร์ชันใหม่",
        "สิทธิ์ในทรัพย์สินทางปัญญาทั้งหมดเป็นของผู้ให้บริการ — สงวนลิขสิทธิ์",
      ]},
    ],
    zh: [
      { h: "条款与条件", p: [
        "使用本网站即表示用户接受全部条款；如不同意，请停止使用。",
        "本网站仅供个人使用，辅助投资决策——未经书面许可，禁止复制、修改、发布或分发内容（包括股票/资产数据库、分析及 AI 结果）用于商业用途。",
        "用户不得滥用系统，如过量请求、试图访问他人数据或干扰服务。",
        "我们可能不时更新条款，并在网站上公告——继续使用即视为接受新版本。",
        "所有知识产权归服务提供方所有，保留所有权利。",
      ]},
    ],
    en: [
      { h: "Terms & Conditions", p: [
        "By using this website, users accept all these terms. If you do not agree, please stop using the service.",
        "This website is for personal use to support investment decisions — copying, reproducing, modifying, publishing or distributing the content (including stock/asset databases, analyses and AI outputs) for commercial purposes is prohibited without prior written permission.",
        "Users must not abuse the system, such as excessive requests, attempting to access others' data, or disrupting the service.",
        "We may update these terms from time to time, announced on the website — continued use constitutes acceptance of the new version.",
        "All intellectual property rights belong to the service provider. All rights reserved.",
      ]},
    ],
  },

  privacy: {
    th: [
      { h: "นโยบายความเป็นส่วนตัว", p: [
        "เราเก็บข้อมูลที่จำเป็นสำหรับการคำนวณดวงเท่านั้น: วันเกิด เวลาเกิด และจังหวัด (ใช้คำนวณแผนภูมิบาจื่อและธาตุ) พร้อมข้อมูลการใช้งานทั่วไป (เช่น คำถามที่ถามในแชท, ภาษา) เพื่อพัฒนาบริการ",
        "ข้อมูลวันเกิด/เวลาของคุณถูกเข้ารหัสเป็น chartHash สำหรับคำนวณดวง และถูกเก็บไว้ในระบบของเราเพื่อให้บริการต่อเนื่อง (เช่น ไม่ต้องกรอกใหม่ทุกครั้ง) — เราไม่ขาย หรือส่งต่อข้อมูลส่วนบุคคลของคุณให้บุคคลที่สามเพื่อการตลาด",
        "เราใช้ localStorage ในเบราว์เซอร์ของคุณเพื่อจำผู้ใช้และภาษา — คุณลบได้ทุกเมื่อ",
        "ข้อมูลการใช้งาน (usage) ถูกเก็บแบบไม่ระบุตัวตนสำหรับสถิติภายใน (dashboard) เท่านั้น",
        "หากมีคำถามเกี่ยวกับความเป็นส่วนตัว กรุณาติดต่อผ่านช่องทางที่ประกาศบนเว็บไซต์",
      ]},
    ],
    zh: [
      { h: "隐私政策", p: [
        "我们仅收集计算命盘所需的数据：出生日期、出生时间和省份（用于计算八字和五行），以及一般使用数据（如聊天问题、语言）以改进服务。",
        "您的出生数据会生成 chartHash 用于命盘计算，并存储在我们的系统中以提供持续服务（无需重复填写）——我们不会向第三方出售或转交您的个人数据用于营销。",
        "我们使用浏览器 localStorage 记住用户和语言，您可随时清除。",
        "使用数据（usage）以匿名方式存储，仅用于内部统计（dashboard）。",
        "如有隐私问题，请通过网站公布的联系渠道联系我们。",
      ]},
    ],
    en: [
      { h: "Privacy Policy", p: [
        "We collect only what is needed to calculate your chart: birth date, birth time and province (used to compute the Bazi chart and elements), plus general usage data (e.g. chat questions, language) to improve the service.",
        "Your birth data is hashed into a chartHash for chart calculation and stored on our systems to keep serving you (no need to re-enter) — we do not sell or pass your personal data to third parties for marketing.",
        "We use browser localStorage to remember your user id and language; you can clear it at any time.",
        "Usage data is stored anonymously for internal statistics (dashboard) only.",
        "For privacy questions, contact us through the channels published on the website.",
      ]},
    ],
  },
};

/** เช็คความครบถ้วน — ใช้ในเทสต์ */
export function legalCompleteness(): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [k, sec] of Object.entries(LEGAL)) {
    out[k] = {};
    for (const loc of ["th", "zh", "en"] as const) {
      const blocks = sec[loc];
      const chars = blocks.reduce((a, b) => a + b.p.join("").length, 0);
      out[k][loc] = chars;
    }
  }
  return out;
}
