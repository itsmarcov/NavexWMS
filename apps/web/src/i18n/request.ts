import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const demandee = await requestLocale;
  const valide = (routing.locales as readonly string[]).includes(demandee ?? "");
  const locale = valide ? (demandee as string) : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
