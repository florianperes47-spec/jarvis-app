/**
 * Jarvis, appli universelle iPhone et iPad (chantier 4). Étape 1 (19/10) : appairage, modes, vue web. Suite (20/10,
 * branche chantier4-appli-suite) : écoute continue NATIVE, bouton micro instantané, notifications locales, liens
 * jarvis:// (Siri, bouton Action, préparés), arrière-plan (préparé), habillage interchangeable (src/theme).
 *
 * Une seule base pour tous les appareils :
 * - iPhone 17 Pro Max de Flo (440 × 956 points) ; plus tard l'iPhone 16 du foyer (même appli, son code QR) ;
 * - iPad Air 13" de Flo (1 366 × 1 024 en paysage, clavier, partage d'écran au tiers ou à moitié) ;
 * - iPad du salon (iPad 6, iPadOS 17.7, 2 Go) en mode « foyer ».
 * Le MODE vient du code QR d'appairage scanné au premier lancement (src/adresse.ts), jamais du code.
 * Aucun jeton n'est gardé : le code à usage unique pose le cookie de la page (gardé par la vue web) ; seuls l'adresse,
 * le mode et les réglages vont dans le trousseau (src/reglages.ts).
 */
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { Pairing } from "./src/adresse";
import { Appairage } from "./src/ecrans/Appairage";
import { Jarvis } from "./src/ecrans/Jarvis";
import { Reglages as EcranReglages } from "./src/ecrans/Reglages";
import { styles } from "./src/ecrans/styles";
import * as notifications from "./src/notifications";
import { lireLien, type Ordre } from "./src/raccourcis";
import { charger, defaut, enregistrer, oublier, type Reglages } from "./src/reglages";
import { theme } from "./src/theme/jetons";

type Ecran = "jarvis" | "reglages" | "appairage";

export default function App() {
  const [r, setR] = useState<Reglages | null | undefined>(undefined);   // undefined : lecture du trousseau
  const [entry, setEntry] = useState("");            // le code à usage unique, en mémoire le temps d'entrer
  const [ecran, setEcran] = useState<Ecran>(apercuEcran());
  const [ordre, setOrdre] = useState<{ o: Ordre; n: number } | null>(null);
  const [motif, setMotif] = useState("");            // pourquoi on revient au scanner (session perdue, code périmé)

  useEffect(() => { void charger().then(setR); }, []);

  const keepAwake = !!r && (r.mode === "foyer" || r.awake) && ecran === "jarvis";
  useEffect(() => {
    if (!keepAwake || Platform.OS === "web") return;
    void activateKeepAwakeAsync("jarvis");
    return () => { void deactivateKeepAwake("jarvis"); };
  }, [keepAwake]);

  // Liens jarvis://… (Siri, bouton Action) : seulement avec l'appli installée (pas dans Expo Go).
  useEffect(() => {
    const lire = (url: string | null) => {
      const o = url ? lireLien(url) : null;
      if (o) setOrdre((p) => ({ o, n: (p?.n ?? 0) + 1 }));
    };
    void Linking.getInitialURL().then(lire);
    const sub = Linking.addEventListener("url", (e) => lire(e.url));
    return () => sub.remove();
  }, []);

  const changer = useCallback(async (n: Reglages) => {
    setR(n);
    await enregistrer(n);
  }, []);

  const paired = useCallback(async (p: Pairing) => {
    // Nouvel appareil ou nouveau code : l'adresse et le mode viennent du code ; les réglages repartent par défaut
    // si le mode change (rien de perso ne reste en passant au salon).
    const n = r && r.mode === p.mode ? { ...r, address: p.address } : defaut(p.address, p.mode);
    if (r && r.mode !== p.mode) await notifications.arreter().catch(() => {});
    await oublier();
    await changer(n);
    setEntry(p.entry);
    setMotif("");
    setEcran("jarvis");
  }, [r, changer]);

  // Le PC refuse la session (cookie perdu, code périmé) : droit au scanner, avec la raison (adresse.ts, messageRefus).
  const refus = useCallback((message: string) => { setEntry(""); setMotif(message); setEcran("appairage"); }, []);

  const toggleContinu = useCallback(() => { if (r) void changer({ ...r, continu: !r.continu }); }, [r, changer]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.page} edges={["top", "bottom", "left", "right"]}>
        {r === undefined ? <ActivityIndicator color={theme().couleurs.accent} style={styles.grow} />
          : !r || ecran === "appairage"
            ? <Appairage onPaired={paired} message={motif} onCancel={r ? () => { setMotif(""); setEcran("jarvis"); } : undefined} />
            : ecran === "reglages"
              ? <EcranReglages r={r} onChange={(n) => void changer(n)} onPair={() => { setEntry(""); setEcran("appairage"); }}
                  onClose={() => setEcran("jarvis")} micNatif={!r.microPage} />
              : <Jarvis r={r} entry={entry} ordre={ordre} onSettings={() => setEcran("reglages")}
                  onToggleContinu={toggleContinu} onRefus={refus} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

/** Aperçu web : `?ecran=reglages` ouvre directement les réglages (captures). */
function apercuEcran(): Ecran {
  if (Platform.OS !== "web" || typeof location === "undefined") return "jarvis";
  const e = new URLSearchParams(location.search).get("ecran");
  return e === "reglages" || e === "appairage" ? e : "jarvis";
}
