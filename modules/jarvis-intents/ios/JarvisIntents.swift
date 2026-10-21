// Raccourcis Siri natifs et bouton Action de l'appli Jarvis (chantier 4, 20/10).
// PRÉPARATION : ce fichier n'a JAMAIS été compilé (pas de Mac ni de compte développeur le 20/10). Il ne sert que
// dans un development build ou TestFlight (Expo Go l'ignore). À vérifier au premier `eas build --profile development`.
//
// Ce qu'il fait : Siri et l'appli Raccourcis proposent « Allô Jarvis » et « Parle à Jarvis » sans rien créer à la
// main ; l'action ouvre l'appli sur le lien jarvis://parler (micro lancé, voir src/raccourcis.ts). Le bouton Action
// de l'iPhone 17 Pro Max peut lancer cette action directement (Réglages > Bouton Action > Raccourci > Jarvis).
import AppIntents
import ExpoModulesCore
import Foundation

public class JarvisIntentsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("JarvisIntents")
    Constants(["pret": true])
  }
}

@available(iOS 18.0, *)
struct ParlerAJarvis: AppIntent {
  static var title: LocalizedStringResource = "Parler à Jarvis"
  static var description = IntentDescription("Ouvre Jarvis, micro prêt.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult & OpensIntent {
    return .result(opensIntent: OpenURLIntent(URL(string: "jarvis://parler")!))
  }
}

@available(iOS 18.0, *)
struct ArreterEcoute: AppIntent {
  static var title: LocalizedStringResource = "Arrêter l'écoute de Jarvis"
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult & OpensIntent {
    return .result(opensIntent: OpenURLIntent(URL(string: "jarvis://ecoute?etat=off")!))
  }
}

@available(iOS 18.0, *)
struct JarvisRaccourcis: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: ParlerAJarvis(), phrases: ["Allô \(.applicationName)", "Parle à \(.applicationName)"],
                shortTitle: "Parler à Jarvis", systemImageName: "mic.fill")
    AppShortcut(intent: ArreterEcoute(), phrases: ["Arrête l'écoute de \(.applicationName)"],
                shortTitle: "Arrêter l'écoute", systemImageName: "mic.slash")
  }
}
