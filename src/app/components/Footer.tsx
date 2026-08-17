"use client";

import { useT } from "../lib/i18n";
import Link from "next/link";

export default function Footer() {
  const t = useT();
  return (
    <footer className="footer">
      <p className="footerStatement">{t("disclaimer")}</p>
      <p className="footerLinks">
        <Link href="/report">{t("nav.report")}</Link>
        {" · "}
        <Link href="/stocks">{t("nav.stocks")}</Link>
        {" · "}
        <Link href="/trust">{t("nav.trust")}</Link>
        {" · "}
        <Link href="/legal?p=disclaimer">{t("legal.disclaimer")}</Link>
        {" · "}
        <Link href="/legal?p=risk">{t("legal.risk")}</Link>
        {" · "}
        <Link href="/legal?p=terms">{t("legal.terms")}</Link>
        {" · "}
        <Link href="/legal?p=privacy">{t("legal.privacy")}</Link>
      </p>
    </footer>
  );
}
