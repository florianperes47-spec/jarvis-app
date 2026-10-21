/**
 * Raccourcis Siri et bouton Action de l'iPhone (chantier 4, 20/10) : PRÉPARATION, code seulement.
 *
 * L'appli répond à des liens `jarvis://…` (« scheme » déclaré dans app.json). Avec l'appli installée pour de bon
 * (development build ou TestFlight, donc le compte développeur), un Raccourci Apple « Ouvrir l'URL jarvis://parler »
 * mis sur le bouton Action, ou dit à Siri (« Allô Jarvis »), ouvre l'appli micro prêt. Les intentions natives (Siri
 * sans passer par l'appli Raccourcis) sont préparées dans `modules/jarvis-intents` (Swift, non compilé ici).
 * Dans Expo Go, ces liens ne marchent pas (Expo Go a son propre « exp:// ») : rien à tester avant le compte.
 *
 * - jarvis://parler          : ouvre l'appli et lance le micro (une demande, comme le bouton) ;
 * - jarvis://ecoute?etat=on  : écoute continue en marche (off : arrêt) ;
 * - jarvis://dire?texte=…    : envoie une phrase écrite (mode perso seulement).
 * Rien d'autre n'est accepté (un lien inconnu ne fait rien). Fonction pure, testée par `npm test`.
 */

export type Ordre =
  | { ordre: "parler" }
  | { ordre: "ecoute"; on: boolean }
  | { ordre: "dire"; texte: string };

export const SCHEME = "jarvis";

export function lireLien(lien: string): Ordre | null {
  let url: URL;
  try {
    url = new URL(lien);
  } catch {
    return null;
  }
  if (url.protocol !== `${SCHEME}:`) return null;
  // jarvis://parler : selon le moteur d'URL, « parler » est l'hôte ou le chemin.
  const quoi = (url.hostname || url.pathname.replace(/^\/+/, "")).toLowerCase();
  if (quoi === "parler") return { ordre: "parler" };
  if (quoi === "ecoute") {
    const etat = url.searchParams.get("etat");
    return etat === "on" || etat === "off" ? { ordre: "ecoute", on: etat === "on" } : null;
  }
  if (quoi === "dire") {
    const texte = (url.searchParams.get("texte") || "").trim().slice(0, 500);
    return texte ? { ordre: "dire", texte } : null;
  }
  return null;
}
