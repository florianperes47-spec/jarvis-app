/**
 * Habillage interchangeable de l'appli (chantier 4, 20/10). Le design « Jarvis Flo » (tour 11 de Claude Design)
 * n'est pas choisi : l'interface actuelle reste, mais TOUTES ses couleurs, tailles et réglages du cœur animé sont ici.
 * Changer de design = ajouter un objet `Theme` (par ex. `jarvisFlo`) et changer `THEME_ACTIF` : aucun écran à reprendre.
 */

export type EtatCoeur = "arret" | "ecoute" | "parole" | "reflechit" | "parle" | "pause" | "erreur";

export type Theme = {
  nom: string;
  couleurs: {
    fond: string; surface: string; bord: string; texte: string; doux: string;
    accent: string; accentTexte: string; alerte: string; ok: string;
  };
  rayon: { petit: number; moyen: number; grand: number };
  police: { titre: number; texte: number; aide: number; espacementTitre: number };
  /** Le cœur animé (indicateur d'écoute) : couleur et pulsation par état ; `leger` coupe l'animation (iPad 6). */
  coeur: {
    taille: number;
    couleur: Record<EtatCoeur, string>;
    pulsation: Record<EtatCoeur, { ms: number; echelle: number } | null>;
  };
};

/** L'interface actuelle (19/10), à l'identique. */
export const actuel: Theme = {
  nom: "actuel",
  couleurs: {
    fond: "#0B0F12", surface: "#121A20", bord: "#24313A", texte: "#E6F1F5", doux: "#8FA3AD",
    accent: "#5FD4E8", accentTexte: "#0B0F12", alerte: "#F2B35C", ok: "#5FE8A0",
  },
  rayon: { petit: 8, moyen: 12, grand: 16 },
  police: { titre: 28, texte: 16, aide: 13, espacementTitre: 6 },
  coeur: {
    taille: 56,
    couleur: {
      arret: "#3A4A54", ecoute: "#5FD4E8", parole: "#5FE8A0", reflechit: "#F2B35C", parle: "#5FD4E8",
      pause: "#8FA3AD", erreur: "#F2B35C",
    },
    pulsation: {
      arret: null, pause: null, erreur: null,
      ecoute: { ms: 2400, echelle: 1.06 }, parole: { ms: 500, echelle: 1.15 },
      reflechit: { ms: 900, echelle: 1.1 }, parle: { ms: 700, echelle: 1.12 },
    },
  },
};

/**
 * « Constellation » (tour 17 de Claude Design, validé par Flo le 20/10 ; design/handoff_flo, bloc [data-ambiance="flo"]).
 * En mode Flo, l'appli affiche la page de Jarvis : l'habillage Constellation s'y choisit dans Réglages (par appareil),
 * sans rien changer ici. Ces jetons servent aux écrans natifs (appairage, réglages) le jour où il sera choisi en
 * natif : repos silencieux, donc aucune pulsation pour les états calmes.
 */
export const constellation: Theme = {
  nom: "constellation",
  couleurs: {
    fond: "#000000", surface: "#05080B", bord: "#1A242C", texte: "#E8EEF2", doux: "#8C9AA5",
    accent: "#5CD6F0", accentTexte: "#02040A", alerte: "#F08A6C", ok: "#6FD6A0",
  },
  rayon: { petit: 14, moyen: 20, grand: 28 },
  police: { titre: 30, texte: 16, aide: 13, espacementTitre: 4 },
  coeur: {
    taille: 56,
    couleur: {
      arret: "#8C9AA5", ecoute: "#5CD6F0", parole: "#5CD6F0", reflechit: "#AAECFA", parle: "#5CD6F0",
      pause: "#567CC4", erreur: "#F08A6C",
    },
    pulsation: {
      arret: null, pause: null, erreur: null,
      ecoute: { ms: 1600, echelle: 1.05 }, parole: { ms: 600, echelle: 1.08 },
      reflechit: { ms: 1200, echelle: 1.04 }, parle: { ms: 700, echelle: 1.06 },
    },
  },
};

export const THEMES: Record<string, Theme> = { actuel, constellation };

/** Le design en service : une seule ligne à changer. */
export const THEME_ACTIF = "actuel";

export function theme(nom: string = THEME_ACTIF): Theme {
  return THEMES[nom] ?? actuel;
}
