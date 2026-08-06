import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "./lib/i18n";
import TopBar from "./components/TopBar";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  title: "ดวงนักลงทุน — AI ผู้ช่วยลงทุนคู่ดวง",
  description: "บทวิเคราะห์หุ้น×ดวง รายวัน/สัปดาห์/เดือน + ฤกษ์ยาม + IPO เทียบดวง — อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม ไม่ใช่คำแนะนำการลงทุน",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <LocaleProvider>
          <TopBar />
          <main className="container">{children}</main>
          <Footer />
        </LocaleProvider>
      </body>
    </html>
  );
}
