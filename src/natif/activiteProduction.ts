/**
 * Activité en direct « Production » (Dynamic Island + écran verrouillé), ambiance Jarvis Flo (Constellation, 20/10) :
 * PRÉPARATION, code seulement. Maquette : design/handoff_flo/maquettes/FloEntiteNatif.dc.html (carte « PRODUCTION ·
 * EN COURS » de l'écran verrouillé, île compacte « cœur + % »).
 *
 * Données : le tableau de bord du PC (`/api/dashboard`, déjà relu chaque minute par l'appli en mode Flo), champ
 * `production` = { idle, title, step, eta, done, total } (src/jarvis/ui/fournisseurs.py) et `chain_blocked`.
 * Aucune nouvelle route. Le pourcentage n'est montré que si le PC donne `done` / `total` (souvent absents : on montre
 * alors « fin vers 19 h 20 », jamais un pourcentage inventé).
 * Mise à jour seulement appli ouverte (pas de push : il faudrait APNs et le compte développeur).
 * Fonctions pures, testées par `npm test` ; le natif est dans `modules/jarvis-activite` (Swift, non compilé).
 */

export type ProductionTableau = {
  idle?: boolean; title?: string; step?: string; eta?: string; state?: string;
  done?: number | null; total?: number | null;
} | null | undefined;

export type EtatProduction = "en_cours" | "bloquee" | "terminee";

/** Le contenu envoyé à ActivityKit (mêmes clés que `ContenuProduction` en Swift). */
export type ContenuActivite = {
  etat: EtatProduction;
  /** « PRODUCTION · EN COURS » (étiquette en petites capitales de la maquette). */
  tag: string;
  titre: string;
  etape: string;
  /** 0 à 100, ou null quand le PC ne le donne pas. */
  pct: number | null;
  /** Ligne du bas : « Fin vers 19 h 20 », la raison du blocage, ou « Épisode prêt ». */
  reste: string;
};

export function pourcentage(done: unknown, total: unknown): number | null {
  if (typeof done !== "number" || typeof total !== "number" || !(total > 0) || !(done >= 0)) return null;
  return Math.min(100, Math.round((done / total) * 100));
}

/** Le contenu de l'activité d'après le tableau ; null quand rien ne tourne (et rien ne vient de finir). */
export function contenu(t: { production?: ProductionTableau; chain_blocked?: { text: string } | null },
                        avant: ContenuActivite | null = null): ContenuActivite | null {
  const p = t.production;
  const bloque = t.chain_blocked?.text?.trim();
  if (!p || p.idle || !p.title) {
    // L'épisode suivi vient de finir : on garde la carte « terminée » (ActivityKit la retire seul plus tard).
    if (avant && avant.etat !== "terminee") {
      return { ...avant, etat: "terminee", tag: "PRODUCTION · TERMINÉE", pct: avant.pct === null ? null : 100,
        reste: "Épisode prêt" };
    }
    return null;
  }
  const etat: EtatProduction = bloque ? "bloquee" : "en_cours";
  return {
    etat,
    tag: etat === "bloquee" ? "PRODUCTION · BLOQUÉE" : "PRODUCTION · EN COURS",
    titre: p.title.slice(0, 60),
    etape: (p.step || "").slice(0, 40),
    pct: pourcentage(p.done, p.total),
    reste: (bloque ? bloque : p.eta ? `Fin vers ${p.eta}` : "").slice(0, 80),
  };
}

export type Decision =
  | { faire: "rien" }
  | { faire: "demarrer"; c: ContenuActivite }
  | { faire: "mettre_a_jour"; c: ContenuActivite }
  | { faire: "terminer"; c: ContenuActivite | null };

/** Que faire de l'activité entre deux relevés. Une seule activité à la fois. */
export function decider(avant: ContenuActivite | null, apres: ContenuActivite | null): Decision {
  if (!apres) return avant ? { faire: "terminer", c: null } : { faire: "rien" };
  if (apres.etat === "terminee") return { faire: "terminer", c: apres };
  if (!avant || avant.etat === "terminee" || avant.titre !== apres.titre) return { faire: "demarrer", c: apres };
  return JSON.stringify(avant) === JSON.stringify(apres) ? { faire: "rien" } : { faire: "mettre_a_jour", c: apres };
}
