/**
 * La page Jarvis dans l'appli (vue web iOS), limitée à l'adresse appairée : tout autre site part dans Safari.
 * Le script de la passerelle (pont.ts) est injecté avant le chargement de chaque page.
 */
import { forwardRef } from "react";
import { Linking, StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { sameSite, type Source } from "../adresse";
import { theme } from "../theme/jetons";

export type VueWebProps = {
  uri: string; address: string; script: string;
  source?: Source;                                   // le POST d'appairage au premier lancement (adresse.ts)
  onMessage: (data: string, url: string) => void;
  onLoadStart: () => void; onLoadEnd: () => void;
  onFailed: (message: string) => void;
};

export type VueWebRef = { injectJavaScript: (js: string) => void; reload: () => void };

export const VueWeb = forwardRef<VueWebRef, VueWebProps>(function VueWeb(p, ref) {
  return (
    <WebView ref={ref as never} source={p.source ?? { uri: p.uri }} style={styles.web}
      sharedCookiesEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant" allowsBackForwardNavigationGestures={false}
      setSupportMultipleWindows={false} originWhitelist={["https://*", "about:*"]}
      injectedJavaScriptBeforeContentLoaded={p.script}
      onMessage={(e: WebViewMessageEvent) => p.onMessage(e.nativeEvent.data, e.nativeEvent.url)}
      onShouldStartLoadWithRequest={(request) => {
        if (sameSite(p.address, request.url)) return true;
        void Linking.openURL(request.url);              // tout le reste : dans Safari
        return false;
      }}
      onLoadStart={p.onLoadStart}
      onLoadEnd={p.onLoadEnd}
      onError={(event) => p.onFailed(`Jarvis ne répond pas (${event.nativeEvent.description}).`)}
      onHttpError={(event) => {
        if (event.nativeEvent.statusCode === 403) p.onFailed("Accès refusé : refais l'appairage avec un nouveau code QR.");
      }} />
  );
});

const styles = StyleSheet.create({ web: { flex: 1, backgroundColor: theme().couleurs.fond } });
