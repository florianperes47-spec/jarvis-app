// Activité en direct « Production », côté appli (ambiance Jarvis Flo, 20/10).
// PRÉPARATION : ce fichier n'a JAMAIS été compilé (pas de Mac ni de compte développeur le 20/10). Il ne sert que dans
// un development build ou TestFlight (Expo Go l'ignore : src/natif/activite.ts ne fait alors rien).
//
// L'appli (src/natif/activite.ts) lui passe le contenu en JSON (clés de `ContenuActivite`) après chaque relevé du
// tableau de bord : démarrer, mettre à jour, terminer. L'affichage est dans targets/widgets-jarvis
// (ActiviteProduction.swift). Aucun jeton, aucun réseau ici, aucun bouton (lecture seule).
import ActivityKit
import ExpoModulesCore
import Foundation

// COPIE EXACTE de targets/widgets-jarvis/AttributsProduction.swift (ActivityKit reconnaît le type par son nom).
struct AttributsProduction: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var etat: String      // en_cours | bloquee | terminee
    var tag: String       // « PRODUCTION · EN COURS »
    var titre: String     // titre de l'épisode
    var etape: String     // « rendu des voix »
    var pct: Int?         // seulement si le PC le donne
    var reste: String     // « Fin vers 19 h 20 », raison du blocage, « Épisode prêt »
  }
  var chaine: String = "La Nuit"
}

public class JarvisActiviteModule: Module {
  public func definition() -> ModuleDefinition {
    Name("JarvisActivite")

    AsyncFunction("demarrer") { (json: String) -> Bool in
      guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled,
            let etat = Self.lire(json) else { return false }
      let contenu = ActivityContent(state: etat, staleDate: Date().addingTimeInterval(15 * 60))
      return (try? Activity.request(attributes: AttributsProduction(), content: contenu, pushType: nil)) != nil
    }

    AsyncFunction("mettreAJour") { (json: String) async -> Bool in
      guard #available(iOS 16.2, *), let etat = Self.lire(json) else { return false }
      let contenu = ActivityContent(state: etat, staleDate: Date().addingTimeInterval(15 * 60))
      for a in Activity<AttributsProduction>.activities { await a.update(contenu) }
      return true
    }

    AsyncFunction("terminer") { (json: String?) async in
      guard #available(iOS 16.2, *) else { return }
      let fin = json.flatMap { Self.lire($0) }.map { ActivityContent(state: $0, staleDate: nil) }
      for a in Activity<AttributsProduction>.activities {
        // Fin avec la carte « terminée » : visible encore un moment sur l'écran verrouillé, puis retirée par iOS.
        await a.end(fin, dismissalPolicy: fin == nil ? .immediate : .default)
      }
    }
  }

  static func lire(_ json: String) -> AttributsProduction.ContentState? {
    guard let d = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(AttributsProduction.ContentState.self, from: d)
  }
}
