/**
 * Version des réglages enregistrés (fonction pure, testée sans iPhone).
 * - 2 (20/10 au soir) : en mode Flo, l'écoute continue était remise en marche une fois.
 * - 3 (23/10, lot 4, règle de Flo « micro ouvert seulement pendant une écoute ») : l'écoute continue ET le micro
 *   toujours prêt repassent UNE fois à coupé, dans les deux modes (iPhone, iPad Air, iPad du salon en foyer) : le
 *   micro ne reste plus ouvert (point orange d'iOS) sans un choix de Flo. Flo les rallume dans les Réglages s'il le
 *   veut ; ce choix est ensuite gardé (la migration ne joue qu'une fois, version < 3). La règle 2 n'est plus
 *   appliquée : elle forçait l'écoute continue à vrai.
 */
export const VERSION = 3;

export function migrer<T extends { mode: string; continu: boolean; pret: boolean }>(r: T, version: number): T {
  if (version < 3) return { ...r, continu: false, pret: false };
  return r;
}
