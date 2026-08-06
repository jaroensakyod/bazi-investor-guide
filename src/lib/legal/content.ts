/**
 * เนื้อหา policy (ข้อจำกัด/ความเสี่ยง/เงื่อนไข/ความเป็นส่วนตัว) — 3 ภาษา
 * ขยายตามกฎหมายไทย: PDPA 2562 (มาตรา 20/30-37), พ.ร.บ. หลักทรัพย์ 2535 (IC/IP license),
 * พ.ร.ฎ. บริการแพลตฟอร์มดิจิทัล 2565 (ประกาศ ธพด. 4/2566), พ.ร.บ. คอมพิวเตอร์ 2550
 */

export type LegalBlock = { h: string; p: string[] };
export type LegalSection = Record<"th" | "zh" | "en", LegalBlock[]>;

export const LEGAL: Record<"disclaimer" | "risk" | "terms" | "privacy", LegalSection> = {
  disclaimer: {
    th: [
      { h: "ข้อจำกัดความรับผิดชอบ", p: [
        "ข้อมูล บทวิเคราะห์ และผลลัพธ์ทั้งหมดบนเว็บไซต์ดวงนักลงทุน (รวมถึงแชท AI, พอร์ตเด่นรายเดือน, รายงานหุ้น/สินทรัพย์ และการวิเคราะห์ธาตุ) จัดทำขึ้นเพื่อการให้ข้อมูล การศึกษา และความบันเทิงทางโหราศาสตร์เท่านั้น มิได้มีวัตถุประสงค์เพื่อชักชวนหรือแนะนำให้ซื้อ ขาย หรือถือครองหลักทรัพย์หรือเครื่องมือทางการเงินใด ๆ",
        "ผู้ให้บริการมิได้เป็นและมิได้มีพฤติการณ์เป็นผู้แนะนำการลงทุน (IC) ผู้วางแผนการลงทุน (IP) หรือที่ปรึกษาทางการเงินที่ได้รับใบอนุญาตจากสำนักงานคณะกรรมการกำกับหลักทรัพย์และตลาดหลักทรัพย์ (ก.ล.ต.) หรือหน่วยงานกำกับดูแลอื่น เนื้อหาทั้งหมดจึงไม่เข้าข่ายการให้คำแนะนำการลงทุนรายบุคคลตามกฎหมาย และผู้ใช้ไม่ควรใช้เนื้อหาแทนที่คำแนะนำจากผู้มีใบอนุญาต",
        "การวิเคราะห์อ้างอิงจากหลักโหราศาสตร์จีน (บาจื่อ/ธาตุทั้งห้า) ร่วมกับข้อมูลราคา ข่าวสาร และแนวโน้มตลาด ซึ่งข้อมูลดังกล่าวอาจไม่ครบถ้วน ล่าช้า หรือคลาดเคลื่อนจากความเป็นจริง (รวมถึงราคาที่มิได้เป็นราคาเรียลไทม์) เราไม่รับประกันความถูกต้อง ครบถ้วน หรือความเหมาะสมของข้อมูลต่อวัตถุประสงค์ใด ๆ ของผู้ใช้",
        "ผลการดำเนินงานในอดีต (รวมถึงพอร์ตเด่นรายเดือนที่เคยเผยแพร่) มิได้เป็นสิ่งรับประกันผลลัพธ์ในอนาคต การลงทุนมีความเสี่ยง ผู้ลงทุนอาจได้รับผลขาดทุนรวมถึงการสูญเสียเงินต้นทั้งหมด ผู้ใช้ต้องศึกษาข้อมูลด้วยตนเอง ใช้วิจารณญาณ และรับผิดชอบต่อการตัดสินใจลงทุนของตนแต่เพียงผู้เดียว",
        "เราไม่รับผิดชอบต่อความเสียหายหรือการสูญเสียใด ๆ ไม่ว่าทางตรงหรือทางอ้อม อันเกิดจากการใช้หรือการพึ่งพาข้อมูลบนเว็บไซต์นี้ รวมถึงความเสียหายจากความผิดพลาดของระบบ การหยุดชะงักของบริการ หรือการกระทำของบุคคลที่สาม",
      ]},
    ],
    zh: [
      { h: "免责声明", p: [
        "本网站（ดวงนักลงทุน / 命理投资）提供的所有信息、分析和结果（包括 AI 聊天、月度精选组合、股票/资产报告及五行分析）仅供一般参考、教育和娱乐用途，不构成对任何证券或金融工具的买卖或持有邀请或建议。",
        "本服务提供方并非经泰国证券交易委员会（SEC）或任何监管机构许可的投资顾问（IC）、投资规划师（IP）或财务顾问，所有内容均不构成法律意义上的个性化投资建议；用户不应以此替代持牌顾问的意见。",
        "所有分析基于中国命理（八字/五行）并结合价格、新闻和市场趋势数据；该等数据可能不完整、延迟或与实际情况有出入（包括非实时价格）。我们不保证数据的准确性、完整性或对任何目的的适用性。",
        "过往表现（包括此前发布的月度精选组合）不保证未来结果。投资有风险，投资者可能遭受损失包括损失全部本金。用户须自行研究、独立判断并对自己的投资决策负全部责任。",
        "对于因使用或依赖本网站信息而造成的任何直接或间接损害或损失，包括系统错误、服务中断或第三方行为造成的损失，我们不承担责任。",
      ]},
    ],
    en: [
      { h: "Disclaimer", p: [
        "All information, analyses and outputs on this website (including AI chat, monthly picks, stock/asset reports and element analysis) are provided for general information, education and entertainment purposes only, and do not constitute an offer or recommendation to buy, sell or hold any security or financial instrument.",
        "The provider is not and does not act as a licensed investment consultant (IC), investment planner (IP) or financial advisor under the Securities and Exchange Commission (SEC Thailand) or any regulator; all content is therefore not individualized investment advice under law, and users should not rely on it in place of advice from a licensed professional.",
        "Analyses are based on Chinese astrology (Bazi/Five Elements) combined with price, news and market-trend data, which may be incomplete, delayed or inaccurate (including non-real-time prices). We make no warranty as to the accuracy, completeness or fitness of the information for any purpose.",
        "Past performance (including previously published monthly picks) does not guarantee future results. Investing involves risk; investors may suffer losses including the loss of their entire principal. Users must conduct their own research, exercise their own judgment and bear sole responsibility for their investment decisions.",
        "We accept no liability for any direct or indirect damages or losses arising from the use of or reliance on this website's information, including system errors, service interruptions or acts of third parties.",
      ]},
    ],
  },

  risk: {
    th: [
      { h: "การเปิดเผยความเสี่ยง", p: [
        "การลงทุนในเครื่องมือทางการเงินและ/หรือสกุลเงินดิจิทัลมีความเสี่ยงสูง ราคาอาจผันผวนอย่างรุนแรงในระยะเวลาอันสั้น และผู้ลงทุนอาจสูญเสียเงินลงทุนทั้งหมดหรือมากกว่าเงินลงทุน (กรณีใช้เลเวอเรจ)",
        "เครื่องมือที่มีเลเวอเรจ เช่น ฟิวเจอร์ส ออปชัน อนุพันธ์ และการซื้อขายมาร์จิ้น จะเพิ่มความเสี่ยงทางการเงินอย่างมีนัยสำคัญ ผู้ไม่มีประสบการณ์หรือไม่เข้าใจกลไกควรหลีกเลี่ยงเครื่องมือประเภทนี้โดยสิ้นเชิง",
        "การลงทุนในต่างประเทศหรือสินทรัพย์ที่เป็นสกุลเงินต่างประเทศมีความเสี่ยงจากอัตราแลกเปลี่ยน ภาวะเศรษฐกิจ การเมือง กฎหมาย และภาษีของประเทศนั้น ๆ",
        "สกุลเงินดิจิทัล (คริปโต) และสินทรัพย์ที่เกี่ยวข้องมีความผันผวนสูงมาก อาจขาดสภาพคล่อง และอาจถูกแทรกแซงหรือจำกัดโดยกฎหมายที่เปลี่ยนแปลงได้ตลอดเวลา",
        "ราคาและข้อมูลที่แสดงบนเว็บไซต์อาจไม่ใช่ข้อมูลเรียลไทม์ อาจล่าช้าหรือผิดพลาด และไม่ควรใช้เป็นพื้นฐานของการสั่งซื้อขายจริง ข้อมูลบางส่วนมาจากบุคคลที่สามซึ่งเรามิได้ควบคุม",
        "การวิเคราะห์ตามหลักดวง (บาจื่อ/ธาตุ) เป็นความเชื่อทางวัฒนธรรมที่มีมาแต่โบราณ ใช้เพื่อประกอบการพิจารณาเท่านั้น ไม่ใช่ปัจจัยชี้ขาด และไม่ควรใช้เป็นเหตุผลเดียวในการตัดสินใจลงทุน",
      ]},
    ],
    zh: [
      { h: "风险提示", p: [
        "投资金融工具和/或加密货币具有高风险，价格可能在短期内剧烈波动，投资者可能损失全部本金，杠杆交易下甚至可能损失超过本金。",
        "杠杆工具（如期货、期权、衍生品及保证金交易）会显著增加财务风险，缺乏经验或不了解机制者应完全避免此类工具。",
        "跨境投资或外币资产面临汇率、经济、政治、法律及税务风险。",
        "加密货币及相关资产波动极大，可能缺乏流动性，并可能随时受变化的法律法规干预或限制。",
        "本网站显示的价格和数据可能并非实时、可能延迟或出错，不应作为真实交易依据；部分数据来自我们无法控制的第三方。",
        "命理（八字/五行）分析是历史悠久的文化信仰，仅供参考——不是决定因素，也不应作为投资的唯一依据。",
      ]},
    ],
    en: [
      { h: "Risk Warning", p: [
        "Trading financial instruments and/or cryptocurrencies carries a high level of risk. Prices may fluctuate sharply in short periods, and investors may lose their entire investment — or more than invested when using leverage.",
        "Leveraged instruments such as futures, options, derivatives and margin trading substantially increase financial risk; inexperienced users or those unfamiliar with the mechanics should avoid them entirely.",
        "Cross-border investments or foreign-currency assets are subject to exchange-rate, economic, political, legal and tax risks of the relevant jurisdiction.",
        "Cryptocurrencies and related assets are extremely volatile, may lack liquidity, and may be subject to intervention or restriction by laws that can change at any time.",
        "Prices and data shown on this website may not be real-time, may be delayed or inaccurate, and should not be used as a basis for live trading. Some data comes from third parties beyond our control.",
        "Astrology-based (Bazi/Five Elements) analysis is an ancient cultural belief, provided for consideration only — it is not a decisive factor and should not be the sole basis for any investment decision.",
      ]},
    ],
  },

  terms: {
    th: [
      { h: "ข้อกำหนดและเงื่อนไขการให้บริการ", p: [
        "การเข้าใช้หรือใช้งานเว็บไซต์ดวงนักลงทุน ไม่ว่าโดยช่องทางใด ถือว่าผู้ใช้มีอายุไม่ต่ำกว่า 20 ปีบริบูรณ์ (หรือในกรณีอายุ 10-20 ปี ต้องได้รับความยินยอมจากผู้ใช้อำนาจปกครอง) และยอมรับข้อกำหนดและเงื่อนไขฉบับนี้ทั้งหมด หากไม่เห็นด้วย กรุณาหยุดใช้บริการทันที",
        "บริการนี้จัดทำขึ้นเพื่อการใช้งานส่วนบุคคลของผู้ใช้ ในการประกอบการพิจารณาตัดสินใจร่วมกับข้อมูลจากแหล่งอื่น ห้ามคัดลอก ทำซ้ำ ดัดแปลง เผยแพร่ ขาย หรือแจกจ่ายเนื้อหา ฐานข้อมูลหุ้น/สินทรัพย์ บทวิเคราะห์ และผลลัพธ์ AI (ทั้งฉบับเต็มและบางส่วน) เพื่อวัตถุประสงค์ทางการค้าโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษรจากผู้ให้บริการ และห้ามนำข้อมูลราคาไปเผยแพร่ซ้ำในลักษณะที่ขัดต่อข้อกำหนดของผู้ให้บริการข้อมูลบุคคลที่สาม",
        "ผู้ใช้ตกลงไม่กระทำการอันเป็นการละเมิดกฎหมาย รวมถึงแต่ไม่จำกัดเพียง พ.ร.บ. ว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ พ.ศ. 2550 เช่น การเจาะระบบ การเข้าถึงข้อมูลผู้อื่นโดยมิชอบ การส่งคำขอเกินสมควร การปลอมแปลงตัวตน หรือการรบกวนการทำงานของบริการ — การฝ่าฝืนอาจถูกระงับบัญชีและดำเนินคดีตามกฎหมาย",
        "ผู้ใช้ตกลงว่าการลงทุนและการตัดสินใจทางการเงินเป็นความรับผิดชอบของผู้ใช้แต่เพียงผู้เดียว เนื้อหาในบริการมิได้เป็นคำแนะนำการลงทุนตามที่กฎหมายกำหนด และผู้ใช้ต้องไม่ถือว่าผู้ให้บริการเป็นที่ปรึกษาการลงทุน",
        "เราอาจระงับ จำกัด หรือยกเลิกการให้บริการแก่ผู้ใช้ที่ฝ่าฝืนข้อกำหนด หรือเพื่อความปลอดภัยของระบบ โดยไม่ต้องชดใช้ค่าเสียหายใด ๆ และอาจปรับปรุงข้อกำหนดนี้เป็นครั้งคราว โดยจะประกาศบนเว็บไซต์ — การใช้งานต่อเนื่องหลังการประกาศถือว่าผู้ใช้ยอมรับข้อกำหนดฉบับแก้ไข",
        "ข้อกำหนดนี้อยู่ภายใต้บังคับกฎหมายไทย และข้อพิพาทใด ๆ ให้เสนอต่อศาลไทยที่มีเขตอำนาจ หากข้อกำหนดข้อใดไม่สมบูรณ์หรือไม่ชอบด้วยกฎหมาย ข้อกำหนดข้ออื่นยังคงมีผลบังคับใช้ต่อไป",
        "ในฐานะผู้ให้บริการแพลตฟอร์มดิจิทัล เราจะดำเนินการแจ้งข้อมูลการประกอบธุรกิจต่อสำนักงานพัฒนาธุรกรรมทางอิเล็กทรอนิกส์ (สพธอ./ETDA) ตาม พ.ร.ฎ. การประกอบธุรกิจบริการแพลตฟอร์มดิจิทัลที่ต้องแจ้งให้ทราบ พ.ศ. 2565 และประกาศข้อตกลงและเงื่อนไขนี้ให้ผู้ใช้ทราบตามประกาศ ธพด. 4/2566",
      ]},
    ],
    zh: [
      { h: "条款与条件", p: [
        "使用本网站即表示用户已年满 20 周岁（若为 10-20 周岁，须获得法定监护人同意）并接受全部条款；如不同意，请立即停止使用。",
        "本服务仅供个人使用，辅助投资决策。未经书面许可，禁止复制、修改、发布、出售或分发内容、股票/资产数据库、分析及 AI 结果（全部或部分）用于商业用途；亦不得以违反第三方数据提供方条款的方式再分发价格数据。",
        "用户不得从事任何违法行为，包括但不限于《泰国计算机犯罪法》（2007）：非法入侵、未经授权访问他人数据、过量请求、冒用身份或干扰服务运行——违者可能被暂停账户并追究法律责任。",
        "用户同意投资及财务决策完全由自己负责；本服务内容不构成法律意义上的投资建议，用户不得将服务提供方视为投资顾问。",
        "对于违反条款或为系统安全之需，我们可暂停、限制或终止服务且无需赔偿；我们可能不时更新条款并在网站公告——公告后继续使用即视为接受修订版。",
        "本条款受泰国法律管辖，任何争议提交有管辖权的泰国法院；若某条款无效或不合法，其余条款继续有效。",
        "作为数字平台服务提供方，我们将依据《数字平台服务条例》（2022）及 ETDA 公告 4/2566 向泰国电子交易发展局（ETDA）办理业务登记并向用户公示本条款。",
      ]},
    ],
    en: [
      { h: "Terms & Conditions", p: [
        "By accessing or using this website, users confirm they are at least 20 years old (or, if aged 10–20, have obtained consent from their legal guardian) and accept these terms in full. If you do not agree, please stop using the service immediately.",
        "This service is for personal use to support decision-making alongside other sources. Copying, reproducing, modifying, publishing, selling or distributing the content, stock/asset databases, analyses or AI outputs (in whole or in part) for commercial purposes is prohibited without prior written permission; price data must not be redistributed in any way that violates third-party data provider terms.",
        "Users must not engage in any unlawful conduct, including but not limited to the Computer Crime Act B.E. 2550 (2007): hacking, unauthorized access to others' data, excessive requests, impersonation, or disrupting the service — violations may result in account suspension and legal action.",
        "Users agree that investment and financial decisions are solely their own responsibility; service content does not constitute investment advice under law, and users must not treat the provider as an investment advisor.",
        "We may suspend, restrict or terminate service to users who violate these terms, or for system security, without compensation; we may also update these terms from time to time with notice on the website — continued use after notice constitutes acceptance of the revised terms.",
        "These terms are governed by Thai law, and any disputes shall be submitted to Thai courts of competent jurisdiction. If any provision is invalid or unlawful, the remaining provisions continue in full force.",
        "As a digital platform service provider, we will file our business registration with the Electronic Transactions Development Agency (ETDA) under the Digital Platform Services Decree B.E. 2565 (2022) and publish these terms to users in accordance with ETDA Notification No. 4/2566.",
      ]},
    ],
  },

  privacy: {
    th: [
      { h: "นโยบายความเป็นส่วนตัว (PDPA)", p: [
        "ผู้ควบคุมข้อมูลส่วนบุคคล: ผู้ให้บริการเว็บไซต์ดวงนักลงทุน เก็บรวบรวมข้อมูลส่วนบุคคลตามขอบเขตจำเป็นต่อการให้บริการเท่านั้น ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)",
        "ข้อมูลที่เก็บรวบรวม: (1) ข้อมูลสำหรับคำนวณดวง — วันเกิด เวลาเกิด และจังหวัด (ใช้คำนวณแผนภูมิบาจื่อ/ธาตุ ซึ่งถูกแปลงเป็น chartHash เพื่อใช้ในการวิเคราะห์) (2) ข้อมูลบัญชีการใช้งาน — รหัสผู้ใช้และภาษา (3) ประวัติการสนทนากับแชท AI (จำเป็นต้องส่งให้ผู้ให้บริการโมเดลภาษาบุคคลที่สามเพื่อประมวลผลคำตอบ) (4) ข้อมูลการใช้งานโดยรวม (สถิติคำถาม/ฟีเจอร์) และ (5) ข้อมูลทางเทคนิคของเบราว์เซอร์/อุปกรณ์ขั้นพื้นฐาน",
        "วัตถุประสงค์และฐานกฎหมาย: ใช้ข้อมูลเพื่อให้บริการตามคำขอของผู้ใช้ (จำเป็นต่อการปฏิบัติตามสัญญา) พัฒนาและปรับปรุงบริการ (ประโยชน์โดยชอบด้วยกฎหมาย) และจัดเก็บสถิติภายในแบบไม่ระบุตัวตน — กรณีที่ต้องใช้ฐานความยินยอม เราจะขอความยินยอมแยกต่างหากอย่างชัดเจน และผู้ใช้สามารถถอนความยินยอมได้ตลอดเวลา",
        "ระยะเวลาการเก็บ: เก็บเท่าที่จำเป็นต่อวัตถุประสงค์ข้างต้น หรือจนกว่าผู้ใช้จะร้องขอให้ลบ — ผู้ใช้สามารถขอให้ลบข้อมูลของตนได้ทุกเมื่อ โดยเราจะดำเนินการภายใน 30 วันนับจากได้รับคำขอ",
        "สิทธิของเจ้าของข้อมูล (มาตรา 30-37 PDPA): ผู้ใช้มีสิทธิขอเข้าถึงและขอสำเนาข้อมูล ขอแก้ไขข้อมูลให้ถูกต้อง ขอให้ลบหรือทำลายข้อมูล ขอให้ระงับการใช้ ขอคัดค้านการประมวลผล และขอให้โอนย้ายข้อมูลในรูปแบบที่อ่านได้ด้วยเครื่อง รวมถึงสิทธิถอนความยินยอม — สามารถใช้สิทธิได้โดยติดต่อผ่านช่องทางที่ประกาศบนเว็บไซต์ โดยไม่มีค่าใช้จ่าย",
        "การเปิดเผยต่อบุคคลที่สาม: เราจะไม่ขายหรือให้เช่าข้อมูลส่วนบุคคลของผู้ใช้แก่บุคคลที่สามเพื่อการตลาด ข้อมูลอาจถูกเปิดเผยเท่าที่จำเป็นแก่ (1) ผู้ให้บริการประมวลผลข้อมูล/โครงสร้างพื้นฐาน (เช่น โฮสติ้ง) (2) ผู้ให้บริการโมเดลภาษาสำหรับประมวลผลข้อความแชท และ (3) หน่วยงานรัฐตามที่กฎหมายกำหนด",
        "การส่งหรือโอนข้อมูลข้ามประเทศ: การประมวลผลข้อความแชทอาจต้องส่งข้อมูลไปยังผู้ให้บริการโมเดลภาษาซึ่งตั้งอยู่ในต่างประเทศ เราจะใช้ผู้ให้บริการที่มีมาตรการคุ้มครองข้อมูลตามมาตรฐานสากล และแจ้งให้ผู้ใช้ทราบในเอกสารนี้",
        "คุกกี้และที่เก็บข้อมูลในเครื่อง: เราใช้ localStorage ของเบราว์เซอร์เพื่อจดจำผู้ใช้และภาษา (จำเป็นต่อการทำงานของบริการ) โดยไม่ใช้คุกกี้บุคคลที่สามเพื่อการติดตามโฆษณา — เมื่อมีการใช้คุกกี้ที่ไม่จำเป็น เราจะขอความยินยอมผ่านแบนเนอร์คุกกี้ก่อน และผู้ใช้สามารถลบ/จัดการได้ตลอดเวลา",
        "ความมั่นคงปลอดภัย: เราใช้มาตรการรักษาความปลอดภัยที่เหมาะสม (การเข้ารหัสข้อมูลที่สำคัญ การควบคุมการเข้าถึง การบันทึกเหตุการณ์) เพื่อป้องกันการเข้าถึง เปลี่ยนแปลง หรือเปิดเผยข้อมูลโดยมิชอบ และหากเกิดเหตุการณ์ละเมิดข้อมูลส่วนบุคคลซึ่งมีความเสี่ยงสูงต่อสิทธิและเสรีภาพของผู้ใช้ เราจะแจ้งเตือนผู้ใช้และสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคลโดยไม่ชักช้า ตามมาตรา 37",
        "ผู้เยาว์: บริการนี้กำหนดให้ผู้ใช้มีอายุไม่ต่ำกว่า 20 ปีบริบูรณ์ หากผู้เยาว์อายุ 10-20 ปีประสงค์ใช้บริการ ต้องได้รับความยินยอมจากผู้ใช้อำนาจปกครองตามมาตรา 20 และเราขอสงวนสิทธิ์ในการตรวจสอบ",
        "การเปลี่ยนแปลงนโยบาย: เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว โดยประกาศบนเว็บไซต์และระบุวันที่ปรับปรุงล่าสุด — หากมีข้อสงสัยหรือต้องการใช้สิทธิ กรุณาติดต่อเราผ่านช่องทางที่ประกาศบนเว็บไซต์",
      ]},
    ],
    zh: [
      { h: "隐私政策（PDPA）", p: [
        "数据控制方：本网站服务提供方仅收集提供服务所必需的个人数据，遵循《泰国个人数据保护法》（PDPA，2019）。",
        "收集的数据：(1) 命盘数据——出生日期、出生时间和省份（用于计算八字/五行，并转换为 chartHash 用于分析）；(2) 账户数据——用户 ID 和语言；(3) AI 聊天记录（须发送给第三方语言模型提供商以生成回答）；(4) 总体使用数据（问题/功能统计）；(5) 基本浏览器/设备技术信息。",
        "目的与法律依据：为按用户请求提供服务（履行合同所必需）、开发改进服务（合法利益）及内部匿名统计——如基于同意，我们将单独明确征求同意，用户可随时撤回。",
        "保留期限：为实现上述目的所需，或直至用户要求删除——用户可随时要求删除其数据，我们将在收到请求后 30 天内处理。",
        "数据主体权利（PDPA 第 30-37 条）：访问和获取副本、更正、删除或销毁、限制处理、反对处理、数据可携带权，以及撤回同意——可通过网站公布渠道免费行使。",
        "向第三方披露：我们不会向第三方出售或出租用户个人数据用于营销；仅在必要时向 (1) 数据处理/基础设施提供商（如托管）、(2) 语言模型提供商（用于处理聊天消息）、(3) 法律规定的主管机构披露。",
        "跨境传输：聊天消息处理可能需要将数据发送至位于境外的语言模型提供商；我们将选用具备国际标准保护措施的提供商，并在本文件中告知用户。",
        "Cookie 与本地存储：我们使用浏览器 localStorage 记住用户和语言（服务运行所必需），不使用第三方广告跟踪 Cookie——如使用非必要 Cookie，将先通过 Cookie 横幅征求同意，用户可随时删除/管理。",
        "安全：我们采取适当安全措施（关键数据加密、访问控制、事件日志）防止未经授权的访问、修改或披露；如发生对用户权利造成高风险的个人数据泄露事件，将依第 37 条及时通知用户及个人数据保护委员会。",
        "未成年人：本服务要求用户年满 20 周岁；10-20 周岁未成年人使用须依第 20 条取得法定监护人同意，我们保留核实权利。",
        "政策更新：我们可能不时更新本政策并在网站公告及注明更新日期——如有疑问或行使权利，请通过网站公布渠道联系。",
      ]},
    ],
    en: [
      { h: "Privacy Policy (PDPA)", p: [
        "Data controller: The provider of this website collects only personal data necessary to provide the service, in accordance with the Personal Data Protection Act B.E. 2562 (2019) (PDPA).",
        "Data collected: (1) Chart data — birth date, birth time and province (used to compute the Bazi/Five-Elements chart, hashed into a chartHash for analysis); (2) Account data — user ID and language; (3) AI chat history (sent to a third-party language model provider to generate answers); (4) Aggregate usage data (question/feature statistics); and (5) Basic browser/device technical information.",
        "Purposes and legal bases: to provide the service at the user's request (performance of a contract), to develop and improve the service (legitimate interests), and for internal anonymous statistics — where consent is the basis, we will request it separately and clearly, and users may withdraw consent at any time.",
        "Retention: for as long as needed for the purposes above, or until the user requests deletion — users may request deletion of their data at any time; we will act within 30 days of the request.",
        "Data subject rights (PDPA Sections 30–37): access and obtain a copy, correct, delete or destroy, restrict processing, object to processing, data portability in a machine-readable format, and withdraw consent — exercisable free of charge via the contact channels published on the website.",
        "Disclosure to third parties: We do not sell or rent users' personal data to third parties for marketing. Data may be disclosed only as necessary to (1) data processing/infrastructure providers (e.g. hosting), (2) language model providers (to process chat messages), and (3) authorities as required by law.",
        "Cross-border transfer: Processing chat messages may require sending data to language model providers located abroad; we will use providers with internationally recognized safeguards and inform users in this document.",
        "Cookies and local storage: We use browser localStorage to remember user and language (necessary for the service); we do not use third-party advertising tracking cookies — where non-necessary cookies are used, we will ask for consent via a cookie banner first, and users may clear/manage them at any time.",
        "Security: We apply appropriate safeguards (encryption of critical data, access control, event logging) against unauthorized access, alteration or disclosure; in the event of a personal data breach that poses a high risk to users' rights and freedoms, we will notify users and the Personal Data Protection Committee without undue delay under Section 37.",
        "Minors: This service requires users to be at least 20 years old; minors aged 10–20 must obtain consent from their legal guardian under Section 20, and we reserve the right to verify.",
        "Policy updates: We may update this policy from time to time, announced on the website with a last-updated date — for questions or to exercise rights, contact us via the channels published on the website.",
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
      const chars = sec[loc].reduce((a, b) => a + b.p.join("").length, 0);
      out[k][loc] = chars;
    }
  }
  return out;
}
