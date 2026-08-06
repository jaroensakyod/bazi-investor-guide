"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { t as translate, LOCALES, type Locale, type LocaleKey } from "@/lib/i18n/dictionary";

const LocaleCtx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({ locale: "th", setLocale: () => {} });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("th");
  useEffect(() => {
    const saved = window.localStorage.getItem("duang_locale");
    if (saved && (LOCALES as readonly string[]).includes(saved)) setLocale(saved as Locale);  }, []);
  const apply = (l: Locale) => {
    setLocale(l);
    window.localStorage.setItem("duang_locale", l);
  };
  return <LocaleCtx.Provider value={{ locale, setLocale: apply }}>{children}</LocaleCtx.Provider>;
}

export function useLocale() {
  return useContext(LocaleCtx);
}

/** แปล key ตาม locale ปัจจุบัน */
export function useT() {
  const { locale } = useLocale();
  return (key: LocaleKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
}

const LABELS: Record<Locale, string> = { th: "ไทย", zh: "中文", en: "EN" };

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <span className="langswitch">
      {[...LOCALES].map((l) => (
        <button key={l} className={`langbtn ${locale === l ? "active" : ""}`} onClick={() => setLocale(l)}>
          {LABELS[l]}
        </button>
      ))}
    </span>
  );
}
