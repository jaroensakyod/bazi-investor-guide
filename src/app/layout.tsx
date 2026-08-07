import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "./lib/i18n";
import TopBar from "./components/TopBar";
import Footer from "./components/Footer";
import CookieBanner from "./components/CookieBanner";

export const metadata: Metadata = {
  title: "ดวงนักลงทุน — AI ผู้ช่วยลงทุนคู่ดวง",
  description: "บทวิเคราะห์หุ้น×ดวง รายวัน/สัปดาห์/เดือน + ฤกษ์ยาม + IPO เทียบดวง — อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม ไม่ใช่คำแนะนำการลงทุน",
  metadataBase: new URL("https://duang-investor.example.com"),
  openGraph: {
    title: "🃏 คุณเป็นนักลงทุนธาตุไหน? — ทดลองฟรี 1 นาที",
    description: "กรอกวันเกิด → การ์ดตัวตนการเงินฟรี: รู้ทันทีว่าเทรดได้ไหม · ธาตุที่ต้องเล่น/เลี่ยง · หุ้น+สินทรัพย์ถูกดวง — คำนวณจากดวง 60 กะจื่อ × ข้อมูลตลาดจริง (5,958 หุ้น · 27 ตลาด)",
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: "ดวงนักลงทุน — การ์ดตัวตนนักลงทุน" }],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "🃏 คุณเป็นนักลงทุนธาตุไหน?",
    description: "การ์ดตัวตนการเงินฟรีจากดวง 60 กะจื่อ × หุ้นจริง — ลองฟรี",
    images: ["/og-card.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <LocaleProvider>
          <TopBar />
          <main className="container">{children}</main>
          <Footer />
          <CookieBanner />
        </LocaleProvider>
      </body>
    </html>
  );
}
