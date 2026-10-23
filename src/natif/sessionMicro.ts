/**
 * Le micro natif ouvert et rendu (lot 4 des correctifs du 23/10) — fonctions pures, testées sans iPhone
 * (tests/session_micro.test.mjs) ; useEcoute.ts leur passe les vraies fonctions d'expo-audio.
 *
 * Règle de Flo : le micro n'est ouvert QUE pendant une écoute (bouton micro, ou écoute continue / micro toujours
 * prêt choisis dans les Réglages). Quand il s'arrête : le flux est stoppé (`stop()`), la session audio repasse en
 * lecture seule (`allowsRecording: false`) et, si rien ne joue, elle est rendue à iOS (`setIsAudioActiveAsync(false)`,
 * exposé par expo-audio 57) : le point orange s'éteint.
 *
 * `setIsAudioActiveAsync(false)` met aussi en pause TOUS les lecteurs de l'appli : jamais appelé quand Jarvis va
 * parler (réponse de l'appli) ou quand la page joue un son — dans ces cas, la session passe seulement en lecture.
 */

export type ModeAudio = {
  allowsRecording: boolean; playsInSilentMode: boolean; allowsBackgroundRecording: boolean; shouldPlayInBackground: boolean;
};

/** Ce dont on a besoin d'expo-audio (injecté : les essais passent de faux objets). */
export type Audio = {
  setAudioModeAsync: (mode: Partial<ModeAudio>) => Promise<void>;
  setIsAudioActiveAsync?: (actif: boolean) => Promise<void>;
};

export type FluxMicro = { start(): Promise<void>; stop(): void; isStreaming: boolean };

export function modeEcoute(arrierePlan: boolean): ModeAudio {
  return { allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: arrierePlan, shouldPlayInBackground: arrierePlan };
}

export function modeRepos(arrierePlan: boolean): ModeAudio {
  return { allowsRecording: false, playsInSilentMode: true, allowsBackgroundRecording: false, shouldPlayInBackground: arrierePlan };
}

/** Le micro doit-il être ouvert maintenant ? Jamais sans permission, jamais pendant que Jarvis ou la page parlent,
 * jamais en arrière-plan sauf choix de Flo ; sinon seulement pendant une écoute (bouton) ou par choix (continu, prêt). */
export function microVoulu(e: {
  actif: boolean; permis: boolean; parle: boolean; sonDePage: boolean; premierPlan: boolean; arrierePlan: boolean;
  continu: boolean; pret: boolean; enParole: boolean;
}): boolean {
  if (!e.actif || !e.permis || e.parle || e.sonDePage) return false;
  if (!e.premierPlan && !e.arrierePlan) return false;
  return e.continu || e.pret || e.enParole;
}

/** Filet (23/10, appli iPhone, lot 2 : « témoin orange éteint en moins de 2 s ») : relu chaque seconde, un micro
 * ouvert alors que plus rien ne le veut (fin d'écoute ratée, événement perdu) est refermé au tour suivant. */
export function aRefermer(ouvert: boolean, voulu: boolean): boolean {
  return ouvert && !voulu;
}

/** Ouvre le micro : session en enregistrement d'abord (elle a pu être rendue), puis le flux. */
export async function ouvrirMicro(flux: FluxMicro, audio: Audio, arrierePlan: boolean): Promise<void> {
  await audio.setAudioModeAsync(modeEcoute(arrierePlan)).catch(() => {});
  await flux.start();
}

/** Rend le micro. `silence` : rien ne va jouer (ni Jarvis, ni la page) → la session est aussi désactivée.
 * Rend la liste de ce qui a été fait (journal, essais). Ne lève jamais. */
export async function fermerMicro(flux: FluxMicro | null, audio: Audio, o: { arrierePlan: boolean; silence: boolean }): Promise<string[]> {
  const fait: string[] = [];
  try { if (flux && flux.isStreaming) { flux.stop(); fait.push("stop"); } } catch { /* déjà arrêté */ }
  try { await audio.setAudioModeAsync(modeRepos(o.arrierePlan)); fait.push("lecture seule"); } catch { /* mode refusé */ }
  if (o.silence && typeof audio.setIsAudioActiveAsync === "function") {
    try { await audio.setIsAudioActiveAsync(false); fait.push("session rendue"); } catch { /* déjà rendue */ }
  }
  return fait;
}
