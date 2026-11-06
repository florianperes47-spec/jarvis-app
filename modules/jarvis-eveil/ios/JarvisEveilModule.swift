// Mot d'éveil « Jarvis » sur l'appareil (06/11, mission de Flo) : le micro reste dans l'iPhone ou l'iPad tant que le
// mot n'est pas dit ; RIEN ne part au hub avant. Dès le mot : événement « eveil » (avec les 1,5 s d'avant, pour
// « Jarvis, quelle heure est-il ? » d'une traite), puis le son en continu (« pcm », 100 ms) jusqu'à flux(false),
// et retour à la veille. L'appli montre un voyant tant que demarrer() tient le micro.
import AVFoundation
import ExpoModulesCore

public class JarvisEveilModule: Module {
  private let file = DispatchQueue(label: "fr.flo.jarvis.eveil")
  private var moteur: AVAudioEngine?
  private var convertisseur: AVAudioConverter?
  private var chaine: ChaineEveil?
  private var attente = [Float]()                     // échantillons 16 kHz pas encore passés à la chaîne
  private var avant = [Int16]()                       // les 1,5 dernières secondes (début de phrase)
  private var lot = [Int16]()                         // son envoyé à l'appli après le mot, par 100 ms
  private var seuil: Float = 0.5
  private var calmeJusqua = Date.distantPast           // pas deux réveils pour le même mot
  private var enFlux = false
  private var modele = "jarvis.onnx"
  private var stats = (n: 0, ms: 0.0, pire: 0.0, debut: Date())
  private let format16 = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16000, channels: 1,
                                       interleaved: false)!

  public func definition() -> ModuleDefinition {
    Name("JarvisEveil")
    Events("eveil", "pcm", "etat")

    AsyncFunction("demarrer") { (seuil: Double, modele: String) in
      try self.demarrer(seuil: Float(seuil), modele: modele)
    }
    Function("arreter") { self.arreter(raison: "demande") }
    Function("flux") { (actif: Bool) in
      self.file.async {
        self.enFlux = actif
        self.lot = []
        if !actif { self.chaine?.reset(); self.calmeJusqua = Date().addingTimeInterval(1.0) }
      }
    }
    Function("reglerSeuil") { (seuil: Double) in self.file.async { self.seuil = Float(seuil) } }
    Function("actif") { () -> Bool in self.moteur?.isRunning ?? false }
    // Auto-contrôle (séance guidée) : extraits int16 16 kHz en base64 → score max de chacun, à comparer au PC.
    AsyncFunction("autoControle") { (extraits: [String], modele: String) -> [Double] in
      let chaine = try ChaineEveil(dossier: self.dossierModeles(), modeleMot: modele)
      return try extraits.map { b64 in
        guard let d = Data(base64Encoded: b64) else { return -1 }
        let pcm = d.withUnsafeBytes { Array($0.bindMemory(to: Int16.self)) }
        return Double(try chaine.scoreMax(pcm))
      }
    }
    OnDestroy { self.arreter(raison: "fin") }
  }

  private func dossierModeles() throws -> URL {
    let pod = Bundle(for: JarvisEveilModule.self)
    if let url = pod.url(forResource: "JarvisEveilModeles", withExtension: "bundle") { return url }
    if let res = pod.resourceURL { return res }
    throw ErreurEveil.modele("dossier des modèles")
  }

  private func emettreEtat(_ etat: String, _ raison: String = "") {
    sendEvent("etat", ["etat": etat, "raison": raison])
  }

  private func demarrer(seuil: Float, modele: String) throws {
    arreter(raison: "relance")
    self.seuil = seuil
    self.modele = modele
    chaine = try ChaineEveil(dossier: try dossierModeles(), modeleMot: modele)

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .default,
                            options: [.defaultToSpeaker, .allowBluetooth, .mixWithOthers])
    try session.setPreferredSampleRate(16000)
    try session.setActive(true)

    let moteur = AVAudioEngine()
    let entree = moteur.inputNode
    let formatEntree = entree.outputFormat(forBus: 0)
    guard formatEntree.sampleRate > 0, let conv = AVAudioConverter(from: formatEntree, to: format16) else {
      throw ErreurEveil.modele("micro indisponible")
    }
    convertisseur = conv
    entree.installTap(onBus: 0, bufferSize: 2048, format: formatEntree) { [weak self] tampon, _ in
      self?.recevoir(tampon)
    }
    moteur.prepare()
    try moteur.start()
    self.moteur = moteur
    stats = (0, 0, 0, Date())

    let nc = NotificationCenter.default
    nc.addObserver(self, selector: #selector(interruption(_:)), name: AVAudioSession.interruptionNotification,
                   object: session)
    nc.addObserver(self, selector: #selector(changement(_:)), name: .AVAudioEngineConfigurationChange, object: moteur)
    nc.addObserver(self, selector: #selector(remiseAZero(_:)), name: AVAudioSession.mediaServicesWereResetNotification,
                   object: session)
    emettreEtat("ecoute")
  }

  private func arreter(raison: String) {
    NotificationCenter.default.removeObserver(self)
    if let m = moteur {
      m.inputNode.removeTap(onBus: 0)
      m.stop()
    }
    let tenait = moteur != nil
    moteur = nil
    convertisseur = nil
    file.async { self.attente = []; self.avant = []; self.lot = []; self.enFlux = false }
    if tenait { emettreEtat("arret", raison) }
  }

  @objc private func interruption(_ n: Notification) {
    guard let brut = n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: brut) else { return }
    if type == .began {
      emettreEtat("coupe", "interruption")            // appel, Siri, autre appli qui prend le micro
    } else {
      let options = (n.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt).map {
        AVAudioSession.InterruptionOptions(rawValue: $0) } ?? []
      if options.contains(.shouldResume) { relancer("reprise") } else { emettreEtat("coupe", "pas de reprise") }
    }
  }

  @objc private func changement(_ n: Notification) { relancer("route") }        // écouteurs, Bluetooth…
  @objc private func remiseAZero(_ n: Notification) { relancer("services audio") }

  private func relancer(_ raison: String) {
    let s = seuil, m = modele
    DispatchQueue.main.async {
      do { try self.demarrer(seuil: s, modele: m); self.emettreEtat("ecoute", raison) }
      catch { self.emettreEtat("coupe", "\(raison) : \(error)") }
    }
  }

  private func recevoir(_ tampon: AVAudioPCMBuffer) {
    guard let conv = convertisseur else { return }
    let capacite = AVAudioFrameCount(Double(tampon.frameLength) * 16000 / tampon.format.sampleRate) + 64
    guard let sortie = AVAudioPCMBuffer(pcmFormat: format16, frameCapacity: capacite) else { return }
    var donne = false
    var erreur: NSError?
    conv.convert(to: sortie, error: &erreur) { _, statut in
      if donne { statut.pointee = .noDataNow; return nil }
      donne = true
      statut.pointee = .haveData
      return tampon
    }
    guard erreur == nil, let canal = sortie.floatChannelData?[0] else { return }
    let echantillons = Array(UnsafeBufferPointer(start: canal, count: Int(sortie.frameLength)))
    file.async { self.traiter(echantillons) }
  }

  private func traiter(_ echantillons: [Float]) {
    let pcm = echantillons.map { Int16(max(-32768, min(32767, ($0 * 32767).rounded()))) }
    avant.append(contentsOf: pcm)
    if avant.count > 24000 { avant.removeFirst(avant.count - 24000) }
    if enFlux {
      lot.append(contentsOf: pcm)
      if lot.count >= 1600 {                           // 100 ms
        sendEvent("pcm", ["b64": donnees(lot).base64EncodedString()])
        lot = []
      }
      return
    }
    attente.append(contentsOf: pcm.map { Float($0) })
    while attente.count >= ChaineEveil.morceau, let chaine = chaine {
      let bloc = Array(attente.prefix(ChaineEveil.morceau))
      attente.removeFirst(ChaineEveil.morceau)
      let t0 = Date()
      guard let score = try? chaine.morceau(bloc) else { continue }
      let ms = Date().timeIntervalSince(t0) * 1000
      stats.n += 1; stats.ms += ms; stats.pire = max(stats.pire, ms)
      if Date().timeIntervalSince(stats.debut) >= 30 {
        sendEvent("etat", ["etat": "mesure", "raison": "", "msMoyen": stats.ms / Double(max(stats.n, 1)),
                           "msPire": stats.pire, "morceaux": stats.n])
        stats = (0, 0, 0, Date())
      }
      if score >= seuil && Date() > calmeJusqua {
        calmeJusqua = Date().addingTimeInterval(2.0)
        enFlux = true                                  // la suite part aussitôt, sans attendre l'appli
        lot = []
        sendEvent("eveil", ["score": Double(score), "avant": donnees(avant).base64EncodedString(),
                            "msChaine": ms])
        attente = []
        return
      }
    }
  }

  private func donnees(_ pcm: [Int16]) -> Data {
    pcm.withUnsafeBufferPointer { Data(buffer: $0) }
  }
}
