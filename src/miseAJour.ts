/**
 * Mises à jour OTA servies par le PC (puis le hub), lot 13 du 22/10 : expo-updates vérifie au lancement
 * (`checkAutomatically: ON_LOAD`) et applique la nouvelle version au lancement SUIVANT. Cette ligne, dans les
 * Réglages, dit quelle version tourne : celle de l'IPA (« intégrée ») ou une mise à jour reçue (date + début de l'id).
 * Fonction pure, testée sans iPhone.
 */
export type InfoMiseAJour = {
  version: string;                 // version native (runtimeVersion, politique appVersion)
  updateId: string | null;         // id de la mise à jour qui tourne (null en Expo Go / développement)
  integree: boolean;               // true : le JavaScript de l'IPA, aucune OTA appliquée
  creeLe: Date | null;
};

export function ligneVersion(i: InfoMiseAJour): string {
  const base = `Version ${i.version || "?"}`;
  if (!i.updateId) return `${base} · développement`;
  if (i.integree) return `${base} · intégrée à l'IPA`;
  const d = i.creeLe;
  const quand = d && !Number.isNaN(d.getTime())
    ? ` du ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} à ` +
      `${String(d.getHours()).padStart(2, "0")} h ${String(d.getMinutes()).padStart(2, "0")}`
    : "";
  return `${base} · mise à jour${quand} (${i.updateId.slice(0, 8)})`;
}
