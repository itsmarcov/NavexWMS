"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("commun");

  return (
    <nav aria-label={t("langue")} className="flex items-center gap-1 rounded-full bg-neutral-100 p-1">
      <Link
        href={pathname}
        locale="fr"
        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
          locale === "fr" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
        }`}
      >
        Français
      </Link>
      <Link
        href={pathname}
        locale="ar"
        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
          locale === "ar" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
        }`}
      >
        العربية
      </Link>
    </nav>
  );
}
