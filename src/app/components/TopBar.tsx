"use client";

import Link from "next/link";
import { LocaleSwitcher, useT } from "../lib/i18n";

export default function TopBar() {
  const t = useT();
  return (
    <header className="topbar">
      <div className="topbarInner">
        <Link href="/" className="brand" aria-label={t("brand")}>
          <span className="brandMark" aria-hidden="true">☯</span>
          <span>{t("brand").replace(/^☯\s*/, "")}</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/personal">{t("nav.personal")}</Link>
          <Link href="/report" className="navCta">{t("nav.report")}</Link>
          <Link href="/assets">{t("nav.assets")}</Link>
          <Link href="/watchlist">{t("nav.watchlist")}</Link>
          <Link href="/trust">{t("nav.trust")}</Link>
          <Link href="/profile">{t("nav.profile")}</Link>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
