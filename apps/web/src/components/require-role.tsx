"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Role, UtilisateurDTO } from "@navex/contracts";
import { utilisateurCourant } from "@/lib/api-client";

function extractLocale(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg === "ar" || seg === "fr" ? seg : "fr";
}

export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const locale = extractLocale(pathname);
  const [utilisateur, setUtilisateur] = useState<UtilisateurDTO | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    utilisateurCourant()
      .then((u) => {
        if (roles.includes(u.role as Role)) {
          setUtilisateur(u);
          setPret(true);
        } else {
          router.replace(`/${locale}`);
        }
      })
      .catch(() => {
        router.replace(`/${locale}/login`);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pret) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ambient">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent" role="status">
          <span className="sr-only">{t("commun.chargement")}</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
