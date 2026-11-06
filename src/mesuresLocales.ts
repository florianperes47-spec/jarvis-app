/**
 * 06/11 (séances guidées) : les 100 dernières mesures de l'appli gardées sur l'appareil (temps du tour, veille du mot,
 * coupures d'iOS), pour que Flo les partage depuis les Réglages sans passer par le journal du hub. Aucun son, aucun
 * texte de phrase : des nombres et des raisons seulement. Effacées à la fermeture de l'appli.
 */
export type Mesure = Record<string, string | number | boolean>;

const MAX = 100;
const memoire: { quand: number; m: Mesure }[] = [];

export function noter(m: Mesure, quand = Date.now()): void {
  memoire.push({ quand, m });
  if (memoire.length > MAX) memoire.splice(0, memoire.length - MAX);
}

export function nombre(): number {
  return memoire.length;
}

/** Texte à partager : une ligne par mesure, heure locale puis les valeurs. */
export function texte(): string {
  const deux = (n: number) => String(n).padStart(2, "0");
  return memoire.map(({ quand, m }) => {
    const d = new Date(quand);
    const h = `${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`;
    return `${h} ${Object.entries(m).map(([k, v]) => `${k}=${v}`).join(" ")}`;
  }).join("\n");
}

export function vider(): void {
  memoire.length = 0;
}
