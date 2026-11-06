// Mot d'éveil sur l'appareil (06/11) : openWakeWord en trois modèles ONNX, la même chaîne que
// appli/banc/eveil/chaine_oww.py (vérifiée identique à openWakeWord 0.6 au 4e chiffre).
// 1 280 échantillons (80 ms, 16 kHz, échelle int16) → mel des 1 280 + 480 derniers → toutes ses trames gardées →
// UN vecteur (embedding) sur les 76 dernières trames → le modèle du mot sur les 16 derniers vecteurs → score 0-1.
import Foundation
import onnxruntime_objc

enum ErreurEveil: Error {
  case modele(String)
  case sortie(String)
}

final class ChaineEveil {
  static let morceau = 1280
  static let contexte = 480
  static let fenetreMel = 76
  static let fenetreEmb = 16

  private let env: ORTEnv
  private let mel: ORTSession
  private let emb: ORTSession
  private let mot: ORTSession
  private let nomMot: String
  private var tampon = [Float]()                       // les 1 280 + 480 derniers échantillons
  private var mels = [[Float]]()                       // trames mel de 32 bandes
  private var embs = [[Float]]()                       // vecteurs de 96

  init(dossier: URL, modeleMot: String) throws {
    env = try ORTEnv(loggingLevel: .warning)
    let options = try ORTSessionOptions()
    try options.setIntraOpNumThreads(1)
    func session(_ nom: String) throws -> ORTSession {
      let chemin = dossier.appendingPathComponent(nom).path
      guard FileManager.default.fileExists(atPath: chemin) else { throw ErreurEveil.modele(nom) }
      return try ORTSession(env: env, modelPath: chemin, sessionOptions: options)
    }
    mel = try session("melspectrogram.onnx")
    emb = try session("embedding_model.onnx")
    mot = try session(modeleMot)
    nomMot = try mot.inputNames().first ?? "x.1"
    reset()
  }

  func reset() {
    tampon = []
    mels = Array(repeating: Array(repeating: 1.0, count: 32), count: ChaineEveil.fenetreMel)   // comme openWakeWord
    embs = Array(repeating: Array(repeating: 0.0, count: 96), count: ChaineEveil.fenetreEmb)
  }

  private func tenseur(_ valeurs: [Float], _ forme: [Int]) throws -> ORTValue {
    var copie = valeurs
    let donnees = NSMutableData(bytes: &copie, length: copie.count * MemoryLayout<Float>.size)
    return try ORTValue(tensorData: donnees, elementType: .float, shape: forme.map { NSNumber(value: $0) })
  }

  private func floats(_ v: ORTValue) throws -> [Float] {
    let d = try v.tensorData() as Data
    return d.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
  }

  /// 80 ms (1 280 échantillons, échelle int16 en Float) → score du mot pour la fenêtre qui finit ici.
  func morceau(_ echantillons: [Float]) throws -> Float {
    tampon.append(contentsOf: echantillons)
    let garde = ChaineEveil.morceau + ChaineEveil.contexte
    if tampon.count > garde { tampon.removeFirst(tampon.count - garde) }

    let sortieMel = try mel.run(withInputs: ["input": try tenseur(tampon, [1, tampon.count])],
                                outputNames: ["output"], runOptions: nil)
    guard let m = sortieMel["output"] else { throw ErreurEveil.sortie("mel") }
    let valeurs = try floats(m)
    let trames = valeurs.count / 32
    for t in 0..<trames {
      mels.append(valeurs[(t * 32)..<((t + 1) * 32)].map { $0 / 10.0 + 2.0 })
    }
    if mels.count > ChaineEveil.fenetreMel + 64 { mels.removeFirst(mels.count - ChaineEveil.fenetreMel - 64) }

    let fenetre = Array(mels.suffix(ChaineEveil.fenetreMel)).flatMap { $0 }
    let sortieEmb = try emb.run(withInputs: ["input_1": try tenseur(fenetre, [1, ChaineEveil.fenetreMel, 32, 1])],
                                outputNames: ["conv2d_19"], runOptions: nil)
    guard let e = sortieEmb["conv2d_19"] else { throw ErreurEveil.sortie("embedding") }
    embs.append(try floats(e))
    if embs.count > ChaineEveil.fenetreEmb { embs.removeFirst(embs.count - ChaineEveil.fenetreEmb) }

    let nomSortie = try mot.outputNames().first ?? "53"
    let sortie = try mot.run(withInputs: [nomMot: try tenseur(embs.flatMap { $0 }, [1, ChaineEveil.fenetreEmb, 96])],
                             outputNames: [nomSortie], runOptions: nil)
    guard let s = sortie[nomSortie] else { throw ErreurEveil.sortie("mot") }
    return try floats(s).first ?? 0
  }

  /// Le score maximal d'un extrait (int16), précédé de 2 s et suivi d'1 s de silence : l'auto-contrôle sur l'appareil
  /// compare ce chiffre à celui du PC (banc/eveil/attendus.json).
  func scoreMax(_ pcm: [Int16]) throws -> Float {
    reset()
    let tout = [Int16](repeating: 0, count: 32000) + pcm + [Int16](repeating: 0, count: 16000)
    var meilleur: Float = 0
    var i = 0
    while i + ChaineEveil.morceau <= tout.count {
      let bloc = tout[i..<(i + ChaineEveil.morceau)].map { Float($0) }
      meilleur = max(meilleur, try morceau(bloc))
      i += ChaineEveil.morceau
    }
    reset()
    return meilleur
  }
}
