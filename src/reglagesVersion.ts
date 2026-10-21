/**
 * Version des réglages enregistrés (fonction pure, testée sans iPhone). 2 (20/10 au soir) : en mode Flo, l'écoute
 * continue est remise en marche une fois (elle avait pu être coupée pendant les premiers essais) ; Flo peut ensuite
 * la couper dans les Réglages, et ce choix est gardé.
 */
export const VERSION = 2;

export function migrer<T extends { mode: string; continu: boolean }>(r: T, version: number): T {
  if (version < 2 && r.mode === "perso") return { ...r, continu: true };
  return r;
}
