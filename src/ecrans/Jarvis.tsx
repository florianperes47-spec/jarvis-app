/**
 * L'écran principal : la page Jarvis (vue web) + le micro natif (cœur et bandeau par-dessus).
 * - Mode Flo : la page du téléphone (étroit : iPhone, iPad au tiers) ou large (iPad plein écran) ; le micro natif
 *   répond à « Touchez pour parler » de la page (une seule commande, 23/10) et son état s'affiche DANS la page ;
 *   notifications locales ; liens jarvis:// (Siri, bouton Action).
 * - Mode foyer : la page du salon, écoute « Jarvis, … » permanente, interface légère (pas d'animation), aucune
 *   donnée perso (routes du salon seulement, pas de tableau de bord ni de notification).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { entrySource, messageRefus, NARROW_PT, sameSite, startUrl } from "../adresse";
import * as routes from "../ecoute/routes";
import { toBase64 } from "../ecoute/wav";
import { useEcoute, type Envoi } from "../natif/useEcoute";
import * as activite from "../natif/activite";
import * as notifications from "../notifications";
import type { Tableau } from "../notifications/alertes";
import * as pont from "../pont";
import type { Ordre } from "../raccourcis";
import type { Reglages } from "../reglages";
import { Coeur, libelle } from "../theme/Coeur";
import { theme } from "../theme/jetons";
import { Logo } from "../theme/Logo";
import { styles } from "./styles";
import { VueWeb, type VueWebRef } from "./VueWeb";

type Attente = { ok: (r: { ok: boolean; status: number; data: unknown }) => void; ko: (e: Error) => void; t: ReturnType<typeof setTimeout> };

export function Jarvis({ r, entry, ordre, onSettings, onToggleContinu, onRefus }: {
  r: Reglages; entry: string; ordre: { o: Ordre; n: number } | null;
  onSettings: () => void; onToggleContinu: () => void;
  onRefus: (message: string) => void;               // le PC refuse la session : retour au scanner (App.tsx)
}) {
  const view = useRef<VueWebRef>(null);
  const [failed, setFailed] = useState("");
  const [pret, setPret] = useState(false);
  const { width } = useWindowDimensions();
  const narrow = width < NARROW_PT;
  const foyer = r.mode === "foyer";
  const nonce = useMemo(() => pont.nouveauNonce(), []);
  const micNatifVoulu = !r.microPage;
  // L'entrée d'abord (le code ne sert qu'une fois), puis la page qui convient à la largeur et au micro.
  const [natifAbsent, setNatifAbsent] = useState(false);     // micro natif absent (Expo Go trop ancien) : la page garde le sien
  const page = useMemo(() => startUrl(r.address, r.mode, narrow ? 0 : 10_000, micNatifVoulu && !natifAbsent, r.continu),
    [r.address, r.mode, narrow, micNatifVoulu, natifAbsent, r.continu]);
  const [uri, setUri] = useState(entry || page);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setUri(page); }, [page]);

  // ---- passerelle : les requêtes de l'appli passent par la page (cookie de session), réponses par message
  const attente = useRef(new Map<number, Attente>());
  const prochain = useRef(1);
  const toutRejeter = useCallback((pourquoi: string) => {
    for (const [, a] of attente.current) { clearTimeout(a.t); a.ko(new Error(pourquoi)); }
    attente.current.clear();
  }, []);
  const pretRef = useRef(false);
  pretRef.current = pret;
  const envoyer: Envoi = useCallback((req, corps) => new Promise((ok, ko) => {
    const id = prochain.current++;
    const js = pont.appel(r.mode, id, req, corps ? toBase64(corps) : undefined);
    if (!js) { ko(new Error("Route refusée.")); return; }
    if (!pretRef.current) { ko(new Error("La page Jarvis n'est pas encore chargée.")); return; }
    const t = setTimeout(() => { attente.current.delete(id); ko(new Error("Le PC met trop de temps à répondre.")); }, 50_000);
    attente.current.set(id, { ok, ko, t });
    view.current?.injectJavaScript(js);
  }), [r.mode]);

  const afficherPage = useCallback((entendu: string, reponse: string, vue?: unknown) => {
    if (!foyer) view.current?.injectJavaScript(pont.afficher(entendu, reponse, vue));
  }, [foyer]);

  // Mesures du micro natif au journal du PC (pont.ts : action « diag » figée, mode Flo seulement).
  const journal = useCallback((m: Record<string, string | number | boolean>) => {
    if (!foyer && pretRef.current) view.current?.injectJavaScript(pont.diag(m));
  }, [foyer]);
  // Foyer : micro prêt = écoute continue (coupée par défaut depuis le 23/10 : choix dans les Réglages).
  const ecoute = useEcoute({ mode: r.mode, continu: r.continu, pret: foyer ? r.continu : r.pret,
    arrierePlan: r.arrierePlan, sens: r.sens, actif: pret && micNatifVoulu, envoyer, afficherPage, journal });
  const micNatif = micNatifVoulu && ecoute.disponible;
  useEffect(() => { if (!ecoute.disponible) setNatifAbsent(true); }, [ecoute.disponible]);
  const script = useMemo(() => pont.scriptPont(nonce, r.mode, micNatif), [nonce, r.mode, micNatif]);
  useEffect(() => { if (pret) view.current?.injectJavaScript(pont.micro(micNatif)); }, [pret, micNatif]);

  // Mode Flo (23/10, appli iPhone, lot 1) : l'état du micro natif est montré par la PAGE (état sous le réacteur,
  // libellé de « Touchez pour parler ») ; plus de pastille ni de bulle par-dessus l'en-tête, une seule commande.
  useEffect(() => {
    if (!foyer && pret && micNatif) view.current?.injectJavaScript(pont.etat(ecoute.etat, ecoute.info, ecoute.reste));
  }, [foyer, pret, micNatif, ecoute.etat, ecoute.info, ecoute.reste]);

  const onMessage = useCallback((data: string, url: string) => {
    if (!sameSite(r.address, url)) return;
    const m = pont.lire(data, nonce);
    if (!m) return;
    if ("ok" in m) {
      const a = attente.current.get(m.id);
      if (a) { clearTimeout(a.t); attente.current.delete(m.id); a.ok({ ok: m.ok, status: m.status, data: m.data }); }
      return;
    }
    if (!("evt" in m)) return;
    if (m.evt === "pret") setPret(true);
    else if (m.evt === "parler") ecoute.parler();
    else if (m.evt === "ecoute") onToggleContinu();
    else if (m.evt === "son" && "id" in m) { const id = m.id; void ecoute.sonPage().then(() => view.current?.injectJavaScript(pont.ack(id))); }
    else if (m.evt === "son-fin") ecoute.sonPageFin();
  }, [r.address, nonce, ecoute, onToggleContinu]);

  // ---- notifications locales (mode Flo) : tableau de bord relu toutes les minutes, page prête
  useEffect(() => {
    if (foyer || !r.notifs || !pret) return;
    let fini = false;
    const relever = async () => {
      if (!(await notifications.preparer()) || fini) return;
      const t = await envoyer(routes.TABLEAU).catch(() => null);
      if (t && t.ok && t.data && !fini) await notifications.suivre(t.data as Tableau).catch(() => {});
      // Activité en direct « Production » (appli installée seulement ; sans le module natif : rien).
      if (t && t.ok && t.data && !fini) await activite.suivre(t.data as Tableau).catch(() => {});
    };
    void relever();
    const minute = setInterval(relever, 60_000);
    return () => { fini = true; clearInterval(minute); };
  }, [foyer, r.notifs, pret, envoyer]);
  useEffect(() => { if (!r.notifs) { void notifications.arreter().catch(() => {}); void activite.arreter().catch(() => {}); } }, [r.notifs]);

  // ---- liens jarvis:// (Siri, bouton Action) : seulement avec l'appli installée
  useEffect(() => {
    if (!ordre || !pret) return;
    const o = ordre.o;
    if (o.ordre === "parler") ecoute.parler();
    else if (o.ordre === "ecoute" && o.on !== r.continu) onToggleContinu();
    else if (o.ordre === "dire" && !foyer) ecoute.dire(o.texte);
  }, [ordre?.n, pret]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <View style={styles.pair}>
        <Logo />
        <Text style={styles.erreur}>{failed}</Text>
        <Text style={styles.aide}>Vérifie que Tailscale est connecté et que Jarvis tourne sur le PC.</Text>
        <Pressable style={styles.bouton} onPress={() => { setFailed(""); setUri(page); view.current?.reload(); }}>
          <Text style={styles.boutonTexte}>Réessayer</Text>
        </Pressable>
        <Pressable onPress={onSettings}><Text style={styles.lien}>Réglages et nouvel appairage</Text></Pressable>
      </View>
    );
  }
  const t = theme();
  const texte = ecoute.info || (ecoute.reponse ? ecoute.reponse : ecoute.entendu ? `« ${ecoute.entendu} »` : "");
  const etiquette = ecoute.etat === "ecoute" && ecoute.reste > 0 ? `Je t'écoute, parle sans dire « Jarvis » (${ecoute.reste} s)`
    : ecoute.etat === "ecoute" ? "Dis « Jarvis, … »" : libelle(ecoute.etat);
  return (
    <View style={styles.grow}>
      <VueWeb ref={view} uri={uri} address={r.address} script={script}
        source={entry && uri === entry ? entrySource(entry) : undefined}
        onMessage={onMessage}
        onLoadStart={() => { setPret(false); toutRejeter("La page se recharge."); }}
        onLoadEnd={() => { if (entry && uri === entry) setUri(page); }}
        onFailed={setFailed}
        onRefused={(status) => onRefus(messageRefus(status, !!entry && uri === entry))} />
      {micNatif && foyer ? (
        <View pointerEvents="box-none" style={[s.dock, s.dockFoyer]}>
          {texte || ecoute.etat !== "arret" ? (
            <View style={[s.bandeau, { backgroundColor: t.couleurs.surface, borderColor: t.couleurs.bord, maxWidth: 640 }]}>
              <Text style={{ color: t.couleurs.doux, fontSize: 16 }} numberOfLines={1}>{etiquette}</Text>
              {texte ? <Text style={{ color: t.couleurs.texte, fontSize: 24 }} numberOfLines={3}>{texte}</Text> : null}
            </View>
          ) : null}
          <Coeur etat={ecoute.etat} leger taille={88} onPress={ecoute.parler} onLongPress={onSettings} />
        </View>
      ) : null}
      <Pressable onLongPress={onSettings} delayLongPress={1500} style={styles.coin} accessibilityLabel="Réglages (appui long)" />
    </View>
  );
}

const s = StyleSheet.create({
  dock: { position: "absolute", flexDirection: "row", alignItems: "flex-end", gap: 10 },
  // Le salon seulement (mode foyer). Mode Flo : plus rien par-dessus la page depuis le 23/10 (la pastille et la bulle
  // en haut recouvraient l'en-tête et doublaient « Touchez pour parler ») ; l'état passe par pont.etat.
  dockFoyer: { right: 28, bottom: 28 },
  bandeau: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
});
