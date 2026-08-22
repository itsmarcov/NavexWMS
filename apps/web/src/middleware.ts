import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const gererI18n = createMiddleware(routing);

/** Cookie de présence posé par le client après login — simple garde UX côté serveur Next. */
const COOKIE_ACCES = "navex_access";

export default function middleware(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/");
  const locale = segments[1] ?? "";
  const reste = "/" + segments.slice(2).join("/");

  const localeConnue = (routing.locales as readonly string[]).includes(locale);
  const estRacineLocale = reste === "/" || reste === "";
  const estPublique = ["/login"].some((p) => reste.startsWith(p));
  const aJeton = Boolean(req.cookies.get(COOKIE_ACCES)?.value);

  if (localeConnue && !estPublique && !estRacineLocale && !aJeton) {
    return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
  }

  return gererI18n(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
