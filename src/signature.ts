/**
 * La signature de l'appli (06/11, mission de Flo) : SideStore signe pour 7 jours (compte Apple gratuit). La date de fin
 * est lue dans le profil embarqué (`embedded.mobileprovision`, posé par SideStore à chaque signature) ; les Réglages
 * l'affichent et une notification locale prévient à J-2 (Background Refresh ou « Refresh All » la repousse).
 * Partie pure (lecture du profil, date du rappel) testée sans iPhone : tests/signature.test.mjs.
 */

/** La date de fin du profil (texte du fichier, le plist est en clair dans l'enveloppe signée), ou null. */
export function expirationDepuisProfil(texte: string): Date | null {
  const m = /<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/.exec(texte);
  if (!m) return null;
  const d = new Date(m[1].trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export const RAPPEL_J = 2;

/** Quand prévenir : J-2 à 10 h (heure de l'appareil) ; tout de suite si J-2 est déjà passé ; null si expirée. */
export function dateRappel(expiration: Date, maintenant: Date): Date | null {
  if (expiration.getTime() <= maintenant.getTime()) return null;
  const rappel = new Date(expiration.getTime() - RAPPEL_J * 86_400_000);
  rappel.setHours(10, 0, 0, 0);
  return rappel.getTime() <= maintenant.getTime() ? new Date(maintenant.getTime() + 60_000) : rappel;
}

/** La ligne des Réglages : « Signature valable jusqu'au 13/11 à 09 h 12 (dans 6 j) ». */
export function ligneSignature(expiration: Date | null, maintenant: Date): string {
  if (!expiration) return "Signature : date inconnue (appli lancée hors SideStore ?)";
  const reste = Math.floor((expiration.getTime() - maintenant.getTime()) / 86_400_000);
  const deux = (n: number) => String(n).padStart(2, "0");
  const quand = `${deux(expiration.getDate())}/${deux(expiration.getMonth() + 1)} à ${deux(expiration.getHours())} h ` +
    `${deux(expiration.getMinutes())}`;
  if (expiration.getTime() <= maintenant.getTime()) return `Signature expirée le ${quand} : ouvre SideStore › Refresh All.`;
  return `Signature valable jusqu'au ${quand} (${reste <= 0 ? "moins d'un jour" : `dans ${reste} j`})`;
}
