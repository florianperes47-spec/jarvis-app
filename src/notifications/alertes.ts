/**
 * Notifications locales du mode Flo (chantier 4, 20/10), tirées du tableau de bord du PC (/api/dashboard, relu par
 * l'appli toutes les minutes tant qu'elle est ouverte). Aucune notification push (il faudrait le compte développeur) :
 * - **rappels** et **minuteurs** : programmés sur l'iPhone à l'heure exacte (ils sonnent même si l'appli est fermée
 *   ensuite, tant qu'ils ont été vus une fois l'appli ouverte) ; annulés s'ils disparaissent du PC ;
 * - **alertes de production** : la chaîne est bloquée (« chain_blocked »), ou un épisode vient de finir ;
 * - **crédits** : la tuile Claude passe en alerte (API : seuil du mois ; abonnement : jauge à 90 % ou plus).
 * Rien pour le salon (mode foyer : aucune donnée perso).
 * Fonctions pures (l'heure vient du tableau de bord), testées par `npm test`.
 */

export type Tableau = {
  now?: number;                                                   // secondes depuis 1970 (heure du PC)
  timers?: { id: number; label?: string; ends_at: number; pause?: boolean }[];
  reminders?: { text: string; at: string }[] | null;              // « 14 h 30 » aujourd'hui ; « lun. 9 h » sinon
  production?: { idle?: boolean; title?: string; step?: string; line?: string } | null;
  chain_blocked?: { text: string } | null;
  claude?: { api?: boolean; alert?: boolean; text?: string; session?: { pct: number | null }; week?: { pct: number | null } } | null;
};

export type Notif = { cle: string; titre: string; corps: string; quand?: number };   // quand : ms ; absent = tout de suite

export type Plan = { programmer: Notif[]; annuler: string[]; maintenant: Notif[] };

/** « 14 h 30 », « 9 h » → l'heure du jour (ms) ; null pour un autre jour (« lun. 9 h »). */
export function heureDuJour(at: string, maintenantMs: number): number | null {
  const m = /^(\d{1,2}) h(?: (\d{2}))?$/.exec(at.trim());
  if (!m) return null;
  const d = new Date(maintenantMs);
  d.setHours(Number(m[1]), m[2] ? Number(m[2]) : 0, 0, 0);
  return d.getTime();
}

const SEUIL_JAUGE = 90;

/** Compare l'ancien et le nouveau tableau ; `deja` : les clés déjà programmées sur l'iPhone. */
export function planifier(avant: Tableau | null, apres: Tableau, deja: Set<string>): Plan {
  const nowMs = (apres.now ?? Date.now() / 1000) * 1000;
  const voulues: Notif[] = [];
  for (const t of apres.timers ?? []) {
    if (t.pause || t.ends_at * 1000 <= nowMs) continue;
    voulues.push({ cle: `minuteur:${t.id}:${Math.round(t.ends_at)}`, titre: "Minuteur terminé",
      corps: t.label ? `« ${t.label} » est terminé.` : "Ton minuteur est terminé.", quand: t.ends_at * 1000 });
  }
  for (const r of apres.reminders ?? []) {
    const quand = heureDuJour(r.at, nowMs);
    if (quand === null || quand <= nowMs) continue;
    voulues.push({ cle: `rappel:${quand}:${r.text}`, titre: "Rappel", corps: r.text, quand });
  }
  const cles = new Set(voulues.map((n) => n.cle));
  const plan: Plan = {
    programmer: voulues.filter((n) => !deja.has(n.cle)),
    annuler: [...deja].filter((c) => !cles.has(c)),
    maintenant: [],
  };
  if (avant === null) return plan;            // premier relevé : on ne réveille pas les vieilles alertes
  const bloque = apres.chain_blocked?.text;
  if (bloque && bloque !== avant.chain_blocked?.text) {
    plan.maintenant.push({ cle: `chaine:${bloque}`, titre: "Production bloquée", corps: bloque });
  }
  const finie = avant.production && !avant.production.idle && avant.production.title && apres.production?.idle;
  if (finie) {
    plan.maintenant.push({ cle: `episode:${avant.production!.title}`, titre: "Production terminée",
      corps: `« ${avant.production!.title} » est fini.` });
  }
  if (credits(apres.claude) && !credits(avant.claude)) {
    const c = apres.claude!;
    plan.maintenant.push({ cle: "credits", titre: "Crédits Claude",
      corps: c.api ? (c.text || "Le budget de l'API approche de la limite du mois.")
        : `Jauge Claude à ${Math.max(c.session?.pct ?? 0, c.week?.pct ?? 0)} %.` });
  }
  return plan;
}

export function credits(c: Tableau["claude"]): boolean {
  if (!c) return false;
  if (c.api) return !!c.alert;
  return Math.max(c.session?.pct ?? 0, c.week?.pct ?? 0) >= SEUIL_JAUGE;
}
