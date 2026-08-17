import type { Metadata } from "next";
import "./design-tokens.css";
import "./globals.css";
import { LocaleProvider } from "./lib/i18n";
import TopBar from "./components/TopBar";
import Footer from "./components/Footer";
import CookieBanner from "./components/CookieBanner";

export const metadata: Metadata = {
  title: "BaZi Investor — Personal Investment Decision OS",
  description: "ระบบช่วยตัดสินใจลงทุนที่แยกหลักฐานตลาด บริบทพอร์ต และเลนส์สะท้อนพฤติกรรมออกจากกัน พร้อมแหล่งข้อมูล ความไม่แน่นอน และเงื่อนไขทบทวน",
  metadataBase: new URL("https://duang-investor.example.com"),
  openGraph: {
    title: "BaZi Investor — ตัดสินใจจากหลักฐานและกติกาของคุณ",
    description: "วิจัยหุ้น เข้าใจข้อจำกัดของพอร์ต และสร้างกติกาก่อนตัดสินใจ โดยไม่ผสมคะแนนตลาดกับ BaZi",
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: "BaZi Investor — Personal Investment Decision OS" }],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BaZi Investor — Personal Investment Decision OS",
    description: "หลักฐานตลาด บริบทพอร์ต และกติกาการตัดสินใจในระบบเดียว",
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
