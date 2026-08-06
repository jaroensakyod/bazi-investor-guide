export default function HomePage() {
  const features = [
    { icon: "🔮", title: "หุ้น × ดวงรายวัน", desc: "วันนี้ธาตุอะไรเด่น หุ้นตัวไหนตรงธาตุ ควรทำ/เลี่ยงอะไร" },
    { icon: "🚀", title: "IPO เทียบดวง", desc: "สัปดาห์นี้มี IPO ตัวไหน ธาตุวันเกิดบริษัทตรงกับดวงคุณไหม" },
    { icon: "🗓️", title: "ฤกษ์รายสัปดาห์", desc: "ยามมงคล สีมงคล ทิศเงิน วันดี/วันเลี่ยงทุกสัปดาห์" },
    { icon: "📑", title: "รายงานสไตล์สถาบัน", desc: "Verdict × พื้นฐาน × Buffett score — ฉบับ PDF เร็วๆ นี้" },
    { icon: "🏠", title: "ซื้อที่ดิน/อสังหา", desc: "เดือนนี้วันธาตุดินวันไหน เหมาะเซ็นสัญญา/โอน" },
    { icon: "📈", title: "หุ้นใต้ผืนน้ำ", desc: "หุ้นที่คนมองไม่เห็นแต่ไม่เสี่ยงเกินไป — risk tier ตามกำลังดวง" },
  ];
  return (
    <div>
      <div className="hero">
        <h1>☯ ดวงนักลงทุน</h1>
        <p>
          AI ผู้ช่วยลงทุนคู่ดวง — วิเคราะห์หุ้น×ธาตุ ฤกษ์ยาม IPO เทียบดวง ตามกำลังดวงของคุณ
          <br />
          <span style={{ fontSize: 13, color: "#9a937f" }}>บทวิเคราะห์อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม — ไม่ใช่คำแนะนำการลงทุน</span>
        </p>
        <a className="btn" href="/profile">
          เริ่มต้น: กรอกวันเกิด →
        </a>{" "}
        <a className="btn secondary" href="/chat">
          ทดลองแชท
        </a>
      </div>
      <div className="features">
        {features.map((f) => (
          <div className="feature" key={f.title}>
            <span style={{ fontSize: 22 }}>{f.icon}</span>
            <b>{f.title}</b>
            {f.desc}
          </div>
        ))}
      </div>
    </div>
  );
}
