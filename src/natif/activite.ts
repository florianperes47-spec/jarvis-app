/**
 * Activité en direct « Production » côté appli : suit le tableau de bord (relu chaque minute en mode Flo) et dit au
 * module natif `JarvisActivite` (modules/jarvis-activite, Swift jamais compilé) quoi démarrer, mettre à jour ou finir.
 * Sans ce module (Expo Go, web, Android, appli pas encore construite) : ne fait rien.
 */
import { requireOptionalNativeModule } from "expo";
import { contenu, decider, type ContenuActivite, type ProductionTableau } from "./activiteProduction";

type ModuleActivite = {
  demarrer(json: string): Promise<boolean>;
  mettreAJour(json: string): Promise<boolean>;
  terminer(json: string | null): Promise<void>;
};

const natif = requireOptionalNativeModule<ModuleActivite>("JarvisActivite");

let avant: ContenuActivite | null = null;

export async function suivre(t: { production?: ProductionTableau; chain_blocked?: { text: string } | null }): Promise<void> {
  if (!natif) return;
  const apres = contenu(t, avant);
  const d = decider(avant, apres);
  if (d.faire === "demarrer") { if (avant) await natif.terminer(null); await natif.demarrer(JSON.stringify(d.c)); }
  else if (d.faire === "mettre_a_jour") await natif.mettreAJour(JSON.stringify(d.c));
  else if (d.faire === "terminer") await natif.terminer(d.c ? JSON.stringify(d.c) : null);
  avant = d.faire === "terminer" ? null : apres;
}

/** Notifications coupées ou nouvel appairage : l'activité s'arrête. */
export async function arreter(): Promise<void> {
  if (avant && natif) await natif.terminer(null);
  avant = null;
}
