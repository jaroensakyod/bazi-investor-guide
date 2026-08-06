"use client";

import Link from "next/link";
import { LocaleSwitcher, useT } from "../lib/i18n";

export default function TopBar() {
  const t = useT();
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        {t("brand")}
      </Link>
      <nav>
        <Link href="/chat">{t("nav.chat")}</Link>
        <Link href="/markets">{t("nav.markets")}</Link>
        <Link href="/stocks">{t("nav.stocks")}</Link>
        <Link href="/assets">{t("nav.assets")}</Link>
        <Link href="/watchlist">{t("nav.watchlist")}</Link>
        <Link href="/report">{t("nav.report")}</Link>
        <Link href="/profile">{t("nav.profile")}</Link>
        <Link href="/admin">{t("nav.admin")}</Link>
        <LocaleSwitcher />
      </nav>
    </header>
  );
}
