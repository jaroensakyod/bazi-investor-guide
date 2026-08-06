"use client";

import { useT } from "../lib/i18n";
import Link from "next/link";

export default function Footer() {
  const t = useT();
  return (
    <footer className="footer">
      <p>{t("disclaimer")}</p>
      <p style={{ marginTop: 6 }}>
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
