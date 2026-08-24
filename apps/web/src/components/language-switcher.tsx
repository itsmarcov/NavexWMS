"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("commun");

  return (
    <nav aria-label={t("langue")} className="flex items-center gap-0.5 rounded-full bg-navex-stone/80 p-0.5 backdrop-blur-sm">
      <Link
        href={pathname}
        locale="fr"
        className={`rounded-full px-3 py-1 text-sm font-medium transition-all duration-200 ${
          locale === "fr" ? "bg-white text-navex-ink shadow-soft" : "text-neutral-400 hover:text-navex-ink"
        }`}
      >
        Français
      </Link>
      <Link
        href={pathname}
        locale="ar"
        className={`rounded-full px-3 py-1 text-sm font-medium transition-all duration-200 ${
          locale === "ar" ? "bg-white text-navex-ink shadow-soft" : "text-neutral-400 hover:text-navex-ink"
        }`}
      >
        العربية
      </Link>
    </nav>
  );
}
