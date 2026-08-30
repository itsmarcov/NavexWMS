import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { TourLauncher } from "@/components/tour-launcher";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: "commun" });
  return { title: t("nom_app") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={inter.variable}>
      <body className="min-h-dvh bg-ambient text-navex-ink antialiased" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TourLauncher />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
