/**
 * Aperçu web (captures sans iPhone) : la vraie page Jarvis n'est PAS chargée (rien n'appelle le PC). Un gabarit
 * neutre tient sa place, pour voir où se posent le cœur, le bandeau et les réglages de l'appli.
 */
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme/jetons";
import type { VueWebProps, VueWebRef } from "./VueWeb";

export type { VueWebProps, VueWebRef };

export const VueWeb = forwardRef<VueWebRef, VueWebProps>(function VueWeb(p, ref) {
  useImperativeHandle(ref, () => ({ injectJavaScript: () => {}, reload: () => {} }), []);
  useEffect(() => { p.onLoadEnd(); }, []);       // eslint-disable-line react-hooks/exhaustive-deps
  const t = theme(), foyer = p.uri.includes("/salon");
  return (
    <View style={[styles.page, { backgroundColor: t.couleurs.fond }]}>
      <View style={[styles.cadre, { borderColor: t.couleurs.bord }]}>
        <Text style={{ color: t.couleurs.doux, fontSize: 13, letterSpacing: 3 }}>APERÇU — PAGE JARVIS ICI</Text>
        <Text style={{ color: t.couleurs.texte, fontSize: foyer ? 40 : 28, fontWeight: "300", marginTop: 12 }}>
          {foyer ? "Foyer · salon" : "Jarvis · Flo"}
        </Text>
        <Text style={{ color: t.couleurs.doux, fontSize: 14, marginTop: 8, textAlign: "center" }}>
          {foyer ? "La page /salon (horloge, courses, recette, télé) s'affiche ici sur l'iPad."
            : "La page du téléphone (/?format=phone) ou large (/) s'affiche ici."}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16 },
  cadre: { flex: 1, borderWidth: 1, borderStyle: "dashed", borderRadius: 16, alignItems: "center", justifyContent: "center", padding: 16 },
});
