/**
 * Réglages de l'appli (appui long en haut à droite, ou sur le cœur). Rien de perso au salon : en mode foyer, seuls
 * l'écoute, la sensibilité et l'appairage sont proposés.
 */
import { nombre as nombreMesures, texte as texteMesures } from "../mesuresLocales";
import { expiration as expirationSignature } from "../natif/signatureNatif";
import { ligneSignature } from "../signature";
import { disponible as eveilDisponible } from "../natif/eveil";
import { Pressable, ScrollView, Switch, Text, useWindowDimensions, View, Share } from "react-native";
import * as Updates from "expo-updates";
import { ORDRE } from "../ecoute/decoupe";
import { ligneVersion } from "../miseAJour";
import type { Reglages as R } from "../reglages";
import { theme } from "../theme/jetons";
import { Logo } from "../theme/Logo";
import { styles } from "./styles";

export function Reglages({ r, onChange, onPair, onClose, micNatif }: {
  r: R; onChange: (r: R) => void; onPair: () => void; onClose: () => void; micNatif: boolean;
}) {
  const { width } = useWindowDimensions();
  const t = theme();
  const perso = r.mode === "perso";
  const ligne = (titre: string, aide: string, valeur: boolean, cle: keyof R) => (
    <View style={styles.ligne} key={cle}>
      <View style={{ flex: 1 }}>
        <Text style={styles.texte}>{titre}</Text>
        {aide ? <Text style={styles.aide}>{aide}</Text> : null}
      </View>
      <Switch value={valeur} onValueChange={(v) => onChange({ ...r, [cle]: v })} trackColor={{ true: t.couleurs.accent }} />
    </View>
  );
  return (
    <ScrollView contentContainerStyle={[styles.pair, { width: Math.min(width - 32, 560) }]}>
      <Logo largeur={220} />
      <Text style={styles.titre}>RÉGLAGES</Text>
      <Text style={styles.aide}>{perso ? "Mode Flo" : "Mode foyer (salon) : aucune donnée perso"} · {r.address.replace(/^https:\/\//, "")}</Text>
      {eveilDisponible() ? ligne("Mot d'éveil sur l'appareil", "06/11 : « Jarvis » est reconnu ici, sur l'iPhone ou l'iPad : rien ne part au hub avant le mot. Un voyant vert reste visible tant que le micro attend le mot. Coupé (par défaut) : rien ne change.", r.eveil, "eveil") : null}
      {ligne("Mot d'éveil « Jarvis » (écoute continue)", "Dis « Jarvis, … » sans toucher l'écran : le micro reste alors ouvert (point orange d'iOS). Coupé (par défaut) : le micro ne s'ouvre qu'à « Touchez pour parler » et se referme dès la fin.", r.continu, "continu")}
      <View style={styles.ligne}>
        <Text style={styles.texte}>Sensibilité du micro</Text>
        <Pressable onPress={() => onChange({ ...r, sens: ORDRE[(ORDRE.indexOf(r.sens) + 1) % ORDRE.length] })}>
          <Text style={styles.lien}>{r.sens} ▾</Text>
        </Pressable>
      </View>
      {perso ? ligne("Micro toujours prêt", "Garde le micro ouvert appli au premier plan, pour que le bouton parte sans délai. Coupé (conseillé) : micro ouvert seulement pendant une écoute.", r.pret, "pret") : null}
      {perso ? ligne("Écran toujours allumé", "", r.awake, "awake") : null}
      {perso ? ligne("Notifications", "Rappels, minuteurs, production, crédits (appli ouverte au moins une fois).", r.notifs, "notifs") : null}
      {ligne("Écoute en arrière-plan", "Écran verrouillé ou autre appli : appli installée seulement (sans effet dans Expo Go).", r.arrierePlan, "arrierePlan")}
      {ligne("Plein écran", "La page occupe tout l'écran, barre d'état comprise ; son contenu reste dans la zone sûre d'iOS (encoche, coins). Coupé : marges noires autour, comme avant le 06/11.", r.pleinEcran, "pleinEcran")}
      {ligne("Micro de la page (secours)", micNatif ? "L'ancienne écoute de la page, sans le micro de l'appli." : "Le micro natif n'est pas disponible ici : la page garde le sien.", r.microPage, "microPage")}
      <Pressable onPress={() => { void Share.share({ message: texteMesures() || "Aucune mesure pour l'instant." }); }}>
        <Text style={styles.lien}>Partager les mesures ({nombreMesures()})</Text>
      </Pressable>
      <Pressable style={styles.bouton} onPress={onClose}><Text style={styles.boutonTexte}>Fermer</Text></Pressable>
      <Pressable onPress={onPair}><Text style={styles.lien}>Nouvel appairage (nouveau code QR)</Text></Pressable>
      <Text style={styles.aide}>{ligneVersion({
        version: Updates.runtimeVersion ?? "", updateId: Updates.updateId,
        integree: Updates.isEmbeddedLaunch, creeLe: Updates.createdAt,
      })}</Text>
      <Text style={styles.aide}>{ligneSignature(expirationSignature(), new Date())}</Text>
    </ScrollView>
  );
}
