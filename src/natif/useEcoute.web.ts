/**
 * Aperçu web de l'appli (captures sans iPhone) : pas de micro natif ni d'appel au PC. L'état affiché vient de
 * l'adresse (`?etat=ecoute|parole|reflechit|parle|pause`), pour montrer chaque écran tel qu'il sera sur l'appareil.
 */
import type { EtatCoeur } from "../theme/jetons";
import type { Ecoute, Options } from "./useEcoute";

const EXEMPLES: Partial<Record<EtatCoeur, { entendu: string; reponse: string; info: string; reste: number }>> = {
  ecoute: { entendu: "", reponse: "", info: "", reste: 0 },
  parole: { entendu: "", reponse: "", info: "", reste: 0 },
  reflechit: { entendu: "Jarvis, mets YouTube sur la télé", reponse: "", info: "", reste: 0 },
  parle: { entendu: "Jarvis, mets YouTube sur la télé", reponse: "C'est parti, YouTube s'ouvre sur la télé.", info: "", reste: 0 },
  pause: { entendu: "", reponse: "", info: "Micro en pause pendant le son de la page.", reste: 0 },
};

export function useEcoute(o: Options): Ecoute {
  const q = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("etat");
  const etat = (q && q in EXEMPLES ? q : o.continu ? "ecoute" : "arret") as EtatCoeur;
  const ex = EXEMPLES[etat] ?? { entendu: "", reponse: "", info: "", reste: 0 };
  const suite = new URLSearchParams(typeof location === "undefined" ? "" : location.search).get("suite");
  return {
    etat, ...ex, reste: suite ? Number(suite) : ex.reste, disponible: true,
    parler: () => {}, couper: () => {}, sonPage: async () => {}, sonPageFin: () => {}, dire: () => {},
  };
}
