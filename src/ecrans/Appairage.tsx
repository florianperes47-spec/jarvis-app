/** Premier lancement (ou « Nouvel appairage ») : scanner le code QR d'appairage ; le coller en secours. */
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";
import { type Pairing, readPairing } from "../adresse";
import { theme } from "../theme/jetons";
import { Logo } from "../theme/Logo";
import { styles } from "./styles";

export function Appairage({ onPaired, onCancel, message = "" }: {
  onPaired: (p: Pairing) => void; onCancel?: () => void;
  message?: string;                                  // retour ici après un refus du PC (session perdue, code périmé)
}) {
  const [permission, ask] = useCameraPermissions();
  const [problem, setProblem] = useState(message);
  const [typed, setTyped] = useState("");
  const done = useRef(false);
  const { width } = useWindowDimensions();
  const t = theme();
  const read = (text: string) => {
    if (done.current) return;
    const result = readPairing(text);
    if (typeof result === "string") { setProblem(result); return; }
    done.current = true;
    onPaired(result);
  };
  return (
    <View style={[styles.pair, { width: Math.min(width - 32, 560) }]}>
      <Logo />
      <Text style={styles.texte}>Scanne le code QR d'appairage :</Text>
      <Text style={styles.aide}>• ton Jarvis : « jarvis telephone --qr » sur le PC ;{"\n"}• l'écran du salon : la page
        « /salon/code » du Jarvis du foyer, sur le PC.</Text>
      {permission?.granted ? (
        <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => read(data)} />
      ) : (
        <Pressable style={styles.bouton} onPress={ask}><Text style={styles.boutonTexte}>Autoriser la caméra</Text></Pressable>
      )}
      <TextInput style={styles.champ} value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false}
        keyboardType="url" placeholder="ou colle le lien du code QR" placeholderTextColor={t.couleurs.doux}
        onSubmitEditing={() => read(typed)} />
      {problem ? <Text style={styles.erreur}>{problem}</Text> : null}
      {onCancel ? <Pressable onPress={onCancel}><Text style={styles.lien}>Annuler</Text></Pressable> : null}
    </View>
  );
}
