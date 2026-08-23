import { redirect } from "next/navigation";

/**
 * Le QR encode {APP_PUBLIC_URL}/scan/{jwt} — un JWT contient des points,
 * le middleware i18n l'ignore donc ; cette page racine redirige vers la
 * route localisée qui porte la logique de scan.
 */
export default function PageScanRacine({ params }: { params: { token: string } }) {
  redirect(`/fr/scan/${params.token}`);
}
