/**
 * L'écoute native de l'appli (chantier 4, 20/10) : le micro de l'iPhone ou de l'iPad, ouvert en permanence tant que
 * l'appli est au premier plan (ou aussi en arrière-plan si Flo l'active : development build seulement).
 *
 * - Flux PCM continu (expo-audio `AudioStream`, 16 kHz mono int16, morceaux de 0,1 s) : pas de micro rouvert à
 *   chaque phrase, donc pas de coupure entre deux demandes (« mets YouTube », « cherche des vidéos de… », « la
 *   deuxième »), et 0,3 s gardées avant chaque phrase.
 * - Découpage des phrases (ecoute/decoupe.ts), envoi au PC par la page (pont.ts) : /api/ecoute (Flo) ou
 *   /api/salon/ecoute (salon) ; réveil « Jarvis, … » décidé par le PC (jarvis.ecoute), conversation ouverte 30 s
 *   après chaque réponse (ecoute/conversation.ts).
 * - Pendant que Jarvis parle, le micro est COUPÉ (pas seulement ignoré) : iOS ne peut pas jouer un son pendant ce
 *   flux (mode « enregistrement ») ; il ne s'entend donc jamais. Il est rouvert dès la fin de la réponse.
 * - Un son de la page (réponse écrite, recette, voix de secours) demande d'abord le haut-parleur : même règle.
 * - Bouton micro : la demande suivante part sans « Jarvis » (/api/voice ou /api/salon/voix), avec les 0,3 s d'avant
 *   l'appui (micro déjà ouvert : instantané).
 */
import {
  AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { Mode } from "../adresse";
import { Conversation, envoyerEnAttente, type Reponse } from "../ecoute/conversation";
import { Decoupeur, type Segment, type Sensibilite } from "../ecoute/decoupe";
import * as routes from "../ecoute/routes";
import { level, normaliser, RATE, versPcm16, wav16k, type Encodage } from "../ecoute/wav";
import type { EtatCoeur } from "../theme/jetons";
import { Lecteur, type Morceau } from "./lecteur";

export type Envoi = (req: routes.Requete, corps?: Uint8Array) => Promise<{ ok: boolean; status: number; data: unknown }>;

export type Options = {
  mode: Mode;
  continu: boolean;          // écoute continue « Jarvis, … »
  pret: boolean;             // micro toujours prêt (sinon ouvert seulement à l'appui ou en écoute continue)
  arrierePlan: boolean;      // garder le micro quand l'appli passe en arrière-plan (development build)
  sens: Sensibilite;
  actif: boolean;            // la page est prête (passerelle) et le micro natif est choisi
  envoyer: Envoi;
  afficherPage: (entendu: string, reponse: string, vue?: unknown) => void;
  journal?: (mesures: Record<string, string | number | boolean>) => void;   // diagnostic au journal du PC (mode Flo)
};

export type Ecoute = {
  etat: EtatCoeur; entendu: string; reponse: string; info: string; reste: number; disponible: boolean;
  parler: () => void;               // bouton micro : commencer, ou envoyer tout de suite (second appui), ou couper Jarvis
  couper: () => void;
  sonPage: () => Promise<void>;     // la page va jouer un son : micro coupé d'abord
  sonPageFin: () => void;
  dire: (texte: string) => void;     // raccourci « jarvis://dire?texte=… » : une phrase écrite
};

// 20/10 au soir : le format par défaut du flux natif (float32), ramené en int16 mono par versPcm16 (wav.ts).
const ENCODAGE: Encodage = "float32";

/** Mesures du micro natif envoyées au journal du PC (diagnostic de l'essai réel ; aucun son n'est envoyé). */
type Mesures = { morceaux: number; octets: number; rate: number; canaux: number; niveaux: number[]; crete: number;
  segments: number; recrees: number; debut: number; envois: number };
const mesuresVides = (): Mesures => ({ morceaux: 0, octets: 0, rate: 0, canaux: 0, niveaux: [], crete: 0, segments: 0,
  recrees: 0, debut: 0, envois: 0 });

type Flux = { start(): Promise<void>; stop(): void; isStreaming: boolean; addListener: (e: string, f: (b: { data: ArrayBuffer; sampleRate: number; channels?: number }) => void) => { remove(): void }; release?: () => void };

export function useEcoute(o: Options): Ecoute {
  const opt = useRef(o); opt.current = o;
  const [etat, setEtat] = useState<EtatCoeur>("arret");
  const [entendu, setEntendu] = useState("");
  const [reponse, setReponse] = useState("");
  const [info, setInfo] = useState("");
  const [reste, setReste] = useState(0);
  const [disponible, setDisponible] = useState(true);

  const flux = useRef<Flux | null>(null);
  const permis = useRef(false);
  const dec = useRef(new Decoupeur(RATE, o.sens));
  const conv = useRef(new Conversation());
  const lecteur = useRef(new Lecteur());
  const parle = useRef(false);          // Jarvis parle (réponse de l'appli)
  const sonDePage = useRef(false);      // la page joue un son
  const finSon = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const occupe = useRef(false);         // une demande attend la réponse du PC
  const enAttente = useRef<Segment | null>(null);
  const premierPlan = useRef(AppState.currentState === "active");
  const chaine = useRef<Promise<void>>(Promise.resolve());
  const disponibleRef = useRef(true);
  const mesures = useRef<Mesures>(mesuresVides());
  const recreer = useRef<() => boolean>(() => false);

  /** Diagnostic au journal du PC (mode perso) : format réel, niveaux (médiane, 90 %, crête), seuil, bruit de fond. */
  const diag = useCallback((pourquoi: string) => {
    const p = opt.current, m = mesures.current, d = dec.current;
    if (p.mode !== "perso" || !p.actif || !p.journal) return;
    const tri = [...m.niveaux].sort((a, b) => a - b), q = (f: number) => tri.length ? tri[Math.floor(f * (tri.length - 1))] : 0;
    const r3 = (v: number) => Math.round(v * 10000) / 10000;
    p.journal({
      pourquoi, morceaux: m.morceaux, octets_par_morceau: m.morceaux ? Math.round(m.octets / m.morceaux) : 0,
      frequence: m.rate, canaux: m.canaux, encodage: ENCODAGE, niveau_median: r3(q(0.5)), niveau_90: r3(q(0.9)),
      crete: r3(m.crete), seuil: d.seuil(), fond: r3(d.fond), sensibilite: d.sens, segments: m.segments,
      envoyes: m.envois, recrees: m.recrees, continu: p.continu,
    });
  }, []);

  const rafraichir = useCallback(() => {
    const ouvert = !!flux.current?.isStreaming;
    const e: EtatCoeur = !disponibleRef.current ? "erreur"
      : parle.current ? "parle"
        : occupe.current ? "reflechit"
          : dec.current.enParole() ? "parole"
            : ouvert && opt.current.continu ? "ecoute"
              : (opt.current.continu || opt.current.pret) && !ouvert ? "pause" : "arret";
    setEtat(e);
    setReste(conv.current.reste(Date.now()));
  }, []);

  /** Le micro doit-il être ouvert maintenant ? */
  const voulu = useCallback(() => {
    const p = opt.current;
    if (!p.actif || !permis.current || parle.current || sonDePage.current) return false;
    if (!premierPlan.current && !p.arrierePlan) return false;
    return p.continu || p.pret || dec.current.enParole();
  }, []);

  const ajuster = useCallback((): Promise<void> => {
    chaine.current = chaine.current.then(async () => {
      const s = flux.current;
      if (!s) return;
      const v = voulu();
      if (v && !s.isStreaming) {
        try { await s.start(); } catch (err) {
          // stop() libère les ressources natives : après une réponse, le même flux peut ne plus redémarrer.
          if (!recreer.current() || !flux.current) throw err;
          mesures.current.recrees += 1;
          await flux.current.start();
        }
        if (!mesures.current.debut) {
          mesures.current.debut = Date.now();
          setTimeout(() => diag("5 s après l'ouverture du micro"), 5000);
          setTimeout(() => diag("30 s après l'ouverture du micro"), 30000);
        }
      }
      else if (!v && s.isStreaming) s.stop();
    }).catch((err: unknown) => {
      setInfo(`Micro indisponible : ${err instanceof Error ? err.message : String(err)}`);
    }).finally(rafraichir);
    return chaine.current;
  }, [voulu, rafraichir]);

  // ---- envoi au PC et réponse
  const jouer = useCallback(async (rep: Reponse) => {
    const p = opt.current;
    if (!rep.audio && !rep.flux) return;
    parle.current = true; await ajuster();                 // micro coupé AVANT le son : Jarvis ne s'entend pas
    try {
      const premier: Morceau = rep.audio ? { audio: rep.audio, ...(rep.premier || {}) } as Morceau : null;
      await lecteur.current.jouer(premier, rep.flux, async (n) => {
        const r = await p.envoyer(routes.flux(p.mode, rep.flux || "", n)).catch(() => null);
        return r && r.ok ? (r.data as Morceau) : null;
      });
    } finally {
      parle.current = false;
      conv.current.ouvrir(Date.now());                       // conversation ouverte 30 s après la fin de la réponse
      void ajuster();                                        // micro rouvert tout de suite
    }
  }, [ajuster]);

  const traiter = useCallback(async (rep: Reponse, ok: boolean, force: boolean) => {
    const p = opt.current, now = Date.now();
    if (force) {                                             // bouton micro : pas de tri « Jarvis » côté PC
      if (!ok || rep.error) { setInfo(rep.error || "Le PC ne répond pas."); return; }
      if (!rep.reply && !rep.heard) { setInfo("Je n'ai rien compris."); return; }
    }
    const suite = force ? { faire: "repondre" as const, texte: String(rep.reply || ""), entendu: String(rep.heard || "") }
      : conv.current.lire(rep, ok, now, p.sens);
    if (suite.faire === "erreur") setInfo(suite.arret ? `Le PC ne répond plus (${suite.message}). J'écoute toujours.` : "");
    if (suite.faire === "ecoute") { setEntendu(rep.heard || "Jarvis"); setReponse(""); setInfo("Je t'écoute…"); }
    if (suite.faire === "stop") { lecteur.current.couper(); setInfo("D'accord, je me tais."); }
    if (suite.faire === "repondre") {
      enAttente.current = null;
      setEntendu(suite.entendu); setReponse(suite.texte); setInfo("");
      p.afficherPage(suite.entendu, suite.texte, rep.vue);
      await jouer(rep);
    }
    return suite;
  }, [jouer]);

  const envoyer = useCallback(async (seg: Segment, force: boolean): Promise<void> => {
    const p = opt.current, now = Date.now();
    if (!force) {
      if (occupe.current) { enAttente.current = seg; return; }      // pas de coupure : il part juste après
      if (!conv.current.peutEnvoyer(now)) return;
      conv.current.noterEnvoi(now);
    } else lecteur.current.couper();
    occupe.current = true; rafraichir();
    const req = force ? routes.parler(p.mode) : routes.ecoute(p.mode, conv.current.ouverte(now));
    let suite;
    try {
      mesures.current.envois += 1;
      const r = await p.envoyer(req, wav16k(normaliser(seg.morceaux), dec.current.rate));
      occupe.current = false; rafraichir();
      suite = await traiter((r.data || {}) as Reponse, r.ok, force);
    } catch (err) {
      occupe.current = false;
      suite = await traiter({ error: err instanceof Error ? err.message : String(err) }, false, force);
    } finally {
      occupe.current = false; rafraichir();
    }
    const suivant = enAttente.current;
    enAttente.current = null;
    if (suivant && suite && envoyerEnAttente(suite)) await envoyer(suivant, false);
  }, [traiter, rafraichir]);

  const surMorceau = useCallback((b: { data: ArrayBuffer; sampleRate: number; channels?: number }) => {
    const d = dec.current, p = opt.current;
    if (b.sampleRate && d.rate !== b.sampleRate) { d.rate = b.sampleRate; d.reset(); }
    d.sens = conv.current.sensibilite(p.sens, Date.now());
    const avant = d.enParole();
    const pcm = versPcm16(b.data, ENCODAGE, b.channels || 1);
    const m = mesures.current, niveau = level(pcm);
    m.morceaux += 1; m.octets += b.data.byteLength; m.rate = b.sampleRate || m.rate; m.canaux = b.channels || 1;
    m.crete = Math.max(m.crete, niveau); m.niveaux.push(niveau); if (m.niveaux.length > 300) m.niveaux.shift();
    const r = d.morceau(pcm);
    if (!r) return;
    if (r.type === "rien") { setInfo("Je n'ai rien entendu."); diag("bouton : rien entendu"); rafraichir(); void ajuster(); return; }
    if (r.type === "segment") m.segments += 1;
    if (r.type === "debut") return;
    if (r.segment.force || avant) { rafraichir(); void envoyer(r.segment, true); void ajuster(); return; }
    if (p.continu) void envoyer(r.segment, false);
  }, [envoyer, ajuster, rafraichir]);

  // ---- le micro natif : créé une fois (recréé si iOS l'a libéré) ; absent (Expo Go trop ancien) → la page garde le sien
  useEffect(() => {
    let sub: { remove(): void } | null = null;
    const creer = (): boolean => {
      try {
        const Module = (AudioModule as unknown as { AudioStream?: new (o: object) => Flux }).AudioStream;
        if (!Module) throw new Error("AudioStream absent");
        sub?.remove();
        try { flux.current?.release?.(); } catch { /* déjà libéré */ }
        const s = new Module({ sampleRate: RATE, channels: 1, encoding: ENCODAGE });
        flux.current = s;
        sub = s.addListener("audioStreamBuffer", (b) => surMorceau(b));
        return true;
      } catch {
        return false;
      }
    };
    if (!creer()) { disponibleRef.current = false; setDisponible(false); rafraichir(); return; }
    recreer.current = creer;
    return () => {
      sub?.remove(); recreer.current = () => false;
      try { flux.current?.stop(); flux.current?.release?.(); } catch { /* déjà libéré */ }
      flux.current = null; lecteur.current.liberer();
    };
  }, [surMorceau, rafraichir]);

  // ---- permission du micro (demandée une fois), mode audio, premier plan / arrière-plan
  useEffect(() => {
    if (!o.actif || !disponible) return;
    (async () => {
      const r = await requestRecordingPermissionsAsync();
      permis.current = r.granted;
      if (!r.granted) setInfo("Micro refusé : Réglages > Jarvis (ou Expo Go) > Micro.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: o.arrierePlan,
        shouldPlayInBackground: o.arrierePlan }).catch(() => {});
      await ajuster();
    })();
  }, [o.actif, o.arrierePlan, disponible, ajuster]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { premierPlan.current = s === "active"; void ajuster(); });
    return () => sub.remove();
  }, [ajuster]);

  useEffect(() => { dec.current.sens = o.sens; void ajuster(); }, [o.continu, o.pret, o.sens, o.mode, ajuster]);

  useEffect(() => {                         // décompte de la conversation ouverte (une fois par seconde)
    const t = setInterval(rafraichir, 1000);
    return () => clearInterval(t);
  }, [rafraichir]);

  const parler = useCallback(() => {
    if (parle.current) { lecteur.current.couper(); return; }             // Jarvis parle : il se tait
    const d = dec.current;
    if (d.enParole()) {                                                  // second appui : la demande part
      const r = d.finirParole();
      if (r?.type === "segment") void envoyer(r.segment, true);
      else setInfo("Je n'ai rien entendu.");
      rafraichir(); void ajuster();
      return;
    }
    setInfo(""); d.commencerParole(); rafraichir(); void ajuster();
  }, [envoyer, ajuster, rafraichir]);

  const couper = useCallback(() => { lecteur.current.couper(); dec.current.annulerParole(); rafraichir(); }, [rafraichir]);

  const sonPage = useCallback(async () => {
    clearTimeout(finSon.current);
    sonDePage.current = true;
    await ajuster();
  }, [ajuster]);

  const sonPageFin = useCallback(() => {
    clearTimeout(finSon.current);
    finSon.current = setTimeout(() => { sonDePage.current = false; void ajuster(); }, 800);   // morceau suivant ?
  }, [ajuster]);

  const dire = useCallback((texte: string) => {
    const p = opt.current;
    lecteur.current.couper();
    occupe.current = true; rafraichir();
    const corps = routes.corpsJson(p.mode === "foyer" ? { text: texte } : { text: texte, speak: false, audio: true });
    p.envoyer(routes.texte(p.mode), corps)
      .then((r) => { occupe.current = false; return traiter({ heard: texte, ...((r.data || {}) as Reponse) }, r.ok, true); })
      .catch((err: unknown) => { occupe.current = false; setInfo(err instanceof Error ? err.message : String(err)); })
      .finally(rafraichir);
  }, [traiter, rafraichir]);

  return { etat, entendu, reponse, info, reste, disponible, parler, couper, sonPage, sonPageFin, dire };
}
