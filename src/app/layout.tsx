import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ดวงนักลงทุน — AI ผู้ช่วยลงทุนคู่ดวง",
  description: "บทวิเคราะห์หุ้น×ดวง รายวัน/สัปดาห์/เดือน + ฤกษ์ยาม + IPO เทียบดวง — อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม ไม่ใช่คำแนะนำการลงทุน",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <header className="topbar">
          <a href="/" className="brand">☯ ดวงนักลงทุน</a>
          <nav>
            <a href="/chat">แชท</a>
            <a href="/report">รายงาน</a>
            <a href="/profile">โปรไฟล์</a>
            <a href="/admin">Dashboard</a>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          ⚠️ นี่คือบทวิเคราะห์อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม — ไม่ใช่คำแนะนำการลงทุน
        </footer>
      </body>
    </html>
  );
}
