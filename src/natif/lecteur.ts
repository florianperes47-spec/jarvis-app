/**
 * Le son des réponses, joué par l'appli (chantier 4, 20/10) : morceau par morceau comme la page (jarvis.js,
 * playReply) — le premier arrive avec la réponse (`audio`), les suivants par /api/flux, le suivant est demandé
 * pendant que le précédent joue. Chaque morceau (WAV en base64) est écrit dans le cache de l'appli puis lu par
 * expo-audio. Le micro est coupé par l'appelant AVANT (Jarvis ne s'entend pas) et rouvert juste APRÈS.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";

export type Morceau = { audio?: string | null; texte?: string; dernier?: boolean } | null;

export class Lecteur {
  private player: AudioPlayer | null = null;
  private tour = 0;
  enCours = false;

  /** Joue la réponse ; `suivant(n)` va chercher le morceau n. Rend false si elle a été coupée. */
  async jouer(premier: Morceau, flux: string | undefined, suivant: (n: number) => Promise<Morceau>): Promise<boolean> {
    const tour = ++this.tour;
    this.enCours = true;
    const fichiers: File[] = [];
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: "doNotMix",
        shouldPlayInBackground: true });
      let part: Morceau = premier && premier.audio ? premier : flux ? await suivant(0) : null;
      let n = 0;
      while (part && tour === this.tour) {
        const apres = !part.dernier && flux ? suivant(n + 1) : null;       // le suivant arrive pendant celui-ci
        if (part.audio) await this.un(part.audio, n, tour, fichiers);
        if (!apres || tour !== this.tour) break;
        part = await apres; n += 1;
      }
      return tour === this.tour;
    } finally {
      if (tour === this.tour) this.enCours = false;
      nettoyer(fichiers);
    }
  }

  /** « Stop » ou nouvelle demande : la réponse se tait tout de suite. */
  couper(): void {
    this.tour += 1;
    this.enCours = false;
    try { this.player?.pause(); } catch { /* déjà arrêté */ }
  }

  liberer(): void {
    this.couper();
    try { this.player?.remove(); } catch { /* déjà libéré */ }
    this.player = null;
  }

  private un(b64: string, n: number, tour: number, fichiers: File[]): Promise<void> {
    const f = new File(Paths.cache, `jarvis-reponse-${tour}-${n}.wav`);
    if (f.exists) f.delete();
    f.create();
    f.write(b64, { encoding: "base64" });
    fichiers.push(f);
    if (!this.player) this.player = createAudioPlayer(null, { updateInterval: 100 });
    const player = this.player;
    return new Promise<void>((fini) => {
      let fait = false;
      const finir = () => { if (fait) return; fait = true; clearInterval(garde); sub.remove(); fini(); };
      const sub = player.addListener("playbackStatusUpdate", (s) => { if (s.didJustFinish) finir(); });
      // Filet : un morceau qui ne finit jamais (fichier illisible), ou la réponse coupée.
      const debut = Date.now();
      const garde = setInterval(() => {
        if (tour !== this.tour) finir();
        const duree = player.duration > 0 ? player.duration * 1000 : 60_000;
        if (Date.now() - debut > duree + 3000) finir();
      }, 250);
      player.replace({ uri: f.uri });
      player.play();
    });
  }

}

function nettoyer(fichiers: File[]): void {
  for (const f of fichiers) { try { if (f.exists) f.delete(); } catch { /* le cache sera vidé par iOS */ } }
}
