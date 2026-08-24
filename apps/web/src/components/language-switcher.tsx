"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("commun");

  return (
    <nav aria-label={t("langue")} className="flex items-center gap-1 rounded-full bg-navex-stone p-1">
      <Link
        href={pathname}
        locale="fr"
        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
          locale === "fr" ? "bg-white text-navex-ink shadow-sm" : "text-neutral-500 hover:text-navex-ink"
        }`}
      >
        Français
      </Link>
      <Link
        href={pathname}
        locale="ar"
        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
          locale === "ar" ? "bg-white text-navex-ink shadow-sm" : "text-neutral-500 hover:text-navex-ink"
        }`}
      >
        العربية
      </Link>
    </nav>
  );
}
