import SwiftUI
import WebKit
import AVFoundation
import CoreImage
import CryptoKit

struct Fixture: Decodable {
    let width: Int, height: Int, durationMs: Int
    let sourceSha256: String
}
struct WebSurface: UIViewRepresentable {
    let web: WKWebView
    func makeUIView(context: Context) -> UIView {
        let host = UIView(); host.clipsToBounds = true; host.addSubview(web); return host
    }
    func updateUIView(_ view: UIView, context: Context) {}
}
@MainActor final class LocalRenderer: NSObject, ObservableObject, WKNavigationDelegate {
    @Published var progress = 0.0
    @Published var busy = false
    @Published var status = "Importer le fichier correspondant au plan préparé." {
        didSet {
            if ProcessInfo.processInfo.arguments.contains("--synthetic-ci") {
                let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                try? status.write(to: folder.appendingPathComponent("ci-stage.txt"), atomically: true, encoding: .utf8)
            }
        }
    }
    private let web: WKWebView = {
        let w = WKWebView(frame: .zero)
        w.isOpaque = false; w.backgroundColor = .clear
        w.scrollView.backgroundColor = .clear; w.scrollView.isScrollEnabled = false
        return w
    }()
    var webSurface: WebSurface { WebSurface(web: web) }
    private func fail(_ text: String) -> NSError {
        NSError(domain: "V28Lab", code: 1, userInfo: [NSLocalizedDescriptionKey: text])
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let scheme = navigationAction.request.url?.scheme
        decisionHandler(scheme == "file" || scheme == "about" ? .allow : .cancel)
    }
    private func load(_ fixture: Fixture) async throws {
        guard let html = Bundle.main.url(forResource: "composition", withExtension: "html") else {
            throw fail("Composition absente : exécuter prepare.mjs avant compilation.")
        }
        web.navigationDelegate = self
        web.frame = CGRect(x: 0, y: 0, width: CGFloat(fixture.width), height: CGFloat(fixture.height))
        web.loadFileURL(html, allowingReadAccessTo: html.deletingLastPathComponent())
        for _ in 0..<300 {
            try await Task.sleep(nanoseconds: 100_000_000)
            if !web.isLoading,
               (try? await web.evaluateJavaScript("Boolean(window.__timelines?.['editplus-social-kinetic-v28-native'])")) as? Bool == true {
                _ = try await web.callAsyncJavaScript("await document.fonts.ready; return true;", arguments: [:], in: nil, contentWorld: .page)
                return
            }
        }
        throw fail("La composition WebKit ne se charge pas.")
    }
    private func overlay(at time: Double) async throws -> CIImage {
        // Same 30fps GSAP sampling as the locked Chromium path.
        let t = floor(time * 30) / 30
        _ = try await web.evaluateJavaScript("window.__timelines['editplus-social-kinetic-v28-native'].seek(\(t),false); true;")
        _ = try await web.callAsyncJavaScript("await Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise((_,reject)=>setTimeout(()=>reject(new Error('WebKit animation-frame timeout')),10000))]); return true;", arguments: [:], in: nil, contentWorld: .page)
        let config = WKSnapshotConfiguration(); config.rect = web.bounds
        config.snapshotWidth = NSNumber(value: Double(web.bounds.width)); config.afterScreenUpdates = false
        let image = try await withCheckedThrowingContinuation { (c: CheckedContinuation<UIImage, Error>) in
            var finished = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 15) {
                if !finished { finished = true; c.resume(throwing: self.fail("WebKit snapshot timeout after 15s")) }
            }
            web.takeSnapshot(with: config) { image, error in
                guard !finished else { return }; finished = true
                if let image { c.resume(returning: image) }
                else { c.resume(throwing: error ?? self.fail("Capture WebKit absente.")) }
            }
        }
        guard let cg = image.cgImage else { throw fail("Capture non convertible.") }
        let ci = CIImage(cgImage: cg)
        return ci.transformed(by: CGAffineTransform(scaleX: web.bounds.width / ci.extent.width,
                                                    y: web.bounds.height / ci.extent.height))
    }
    func run(input: URL) async throws -> URL {
        guard !busy else { throw fail("Un export est déjà en cours.") }
        busy = true; progress = 0
        let oldIdle = UIApplication.shared.isIdleTimerDisabled
        UIApplication.shared.isIdleTimerDisabled = true
        defer { busy = false; UIApplication.shared.isIdleTimerDisabled = oldIdle }
        guard let config = Bundle.main.url(forResource: "fixture", withExtension: "json") else {
            throw fail("fixture.json absent.")
        }
        let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: config))
        let access = input.startAccessingSecurityScopedResource()
        defer { if access { input.stopAccessingSecurityScopedResource() } }
        // Fingerprint prevents applying approved words/timings to a different video.
        let handle = try FileHandle(forReadingFrom: input)
        defer { try? handle.close() }
        var hash = SHA256()
        while let data = try handle.read(upToCount: 1_048_576), !data.isEmpty { hash.update(data: data) }
        guard hash.finalize().map({ String(format: "%02x", $0) }).joined() == fixture.sourceSha256 else {
            throw fail("Rush différent du plan validé. Aucun timing fixe appliqué à un nouveau rush.")
        }
        status = "Validation du rush synthétique"
        let asset = AVURLAsset(url: input)
        guard let video = try await asset.loadTracks(withMediaType: .video).first,
              let audio = try await asset.loadTracks(withMediaType: .audio).first else {
            throw fail("Une vidéo et sa voix originale sont nécessaires.")
        }
        let size = try await video.load(.naturalSize)
        let transform = try await video.load(.preferredTransform)
        guard transform == .identity, Int(size.width) == fixture.width, Int(size.height) == fixture.height else {
            throw fail("Dimensions ou rotation non couvertes par ce premier prototype.")
        }
        let duration = try await asset.load(.duration)
        guard abs(CMTimeGetSeconds(duration) * 1000 - Double(fixture.durationMs)) < 150 else {
            throw fail("Durée différente du plan.")
        }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let silent = folder.appendingPathComponent("video.mp4")
        let final = folder.appendingPathComponent("SocialPlus-V28-iOS.mp4")
        var complete = false
        defer {
            try? FileManager.default.removeItem(at: silent)
            if !complete { try? FileManager.default.removeItem(at: folder) }
        }
        status = "Chargement de la composition verrouillée"
        try await load(fixture)
        status = "Composition chargée ; initialisation AVFoundation"
        let reader = try AVAssetReader(asset: asset)
        let source = AVAssetReaderTrackOutput(track: video, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        guard reader.canAdd(source) else { throw fail("Décodeur indisponible.") }; reader.add(source)
        let writer = try AVAssetWriter(outputURL: silent, fileType: .mp4)
        let sink = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: fixture.width, AVVideoHeightKey: fixture.height])
        sink.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: sink, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: fixture.width, kCVPixelBufferHeightKey as String: fixture.height, kCVPixelBufferIOSurfacePropertiesKey as String: [:]])
        guard writer.canAdd(sink) else { throw fail("Encodeur indisponible.") }; writer.add(sink)
        guard reader.startReading(), writer.startWriting() else { throw reader.error ?? writer.error ?? fail("Démarrage impossible.") }
        defer { if reader.status == .reading { reader.cancelReading() }; if writer.status == .writing { writer.cancelWriting() } }
        writer.startSession(atSourceTime: .zero)
        let context = CIContext()
        var frames = 0
        while let sample = source.copyNextSampleBuffer() {
            try Task.checkCancellation()
            guard UIApplication.shared.applicationState == .active else { throw fail("Garder l’application ouverte pendant l’export. Relancer après interruption.") }
            let pts = CMSampleBufferGetPresentationTimeStamp(sample)
            guard let original = CMSampleBufferGetImageBuffer(sample) else { throw fail("Image source absente.") }
            status = "Capture WebKit image \(frames)"
            let graphic = try await overlay(at: CMTimeGetSeconds(pts))
            while !sink.isReadyForMoreMediaData {
                guard writer.status == .writing else { throw writer.error ?? fail("Encodeur arrêté.") }
                try await Task.sleep(nanoseconds: 5_000_000)
            }
            guard let pool = adaptor.pixelBufferPool else { throw fail("Pool vidéo absent.") }
            var buffer: CVPixelBuffer?
            guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer) == kCVReturnSuccess, let buffer else { throw fail("Mémoire vidéo insuffisante.") }
            context.render(graphic.composited(over: CIImage(cvPixelBuffer: original)), to: buffer,
                           bounds: CGRect(origin: .zero, size: size), colorSpace: CGColorSpaceCreateDeviceRGB())
            guard adaptor.append(buffer, withPresentationTime: pts) else { throw writer.error ?? fail("Écriture image échouée.") }
            frames += 1
            progress = min(0.95, CMTimeGetSeconds(pts) / CMTimeGetSeconds(duration) * 0.95)
            status = "Composition locale : \(frames) images"
        }
        guard reader.status == .completed, frames > 0 else { throw reader.error ?? fail("Décodage incomplet.") }
        writer.endSession(atSourceTime: duration)
        sink.markAsFinished(); await writer.finishWriting()
        guard writer.status == .completed else { throw writer.error ?? fail("Vidéo incomplète.") }
        let composition = AVMutableComposition()
        let encoded = AVURLAsset(url: silent)
        guard let encodedTrack = try await encoded.loadTracks(withMediaType: .video).first,
              let v = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
              let a = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw fail("Assemblage impossible.") }
        let range = CMTimeRange(start: .zero, duration: duration)
        try v.insertTimeRange(range, of: encodedTrack, at: .zero)
        try a.insertTimeRange(range, of: audio, at: .zero)
        guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else { throw fail("Remux indisponible.") }
        export.outputURL = final; export.outputFileType = .mp4; export.shouldOptimizeForNetworkUse = true
        await export.export()
        guard export.status == .completed else { throw export.error ?? fail("Export MP4 échoué.") }
        let output = AVURLAsset(url: final)
        guard try await output.loadTracks(withMediaType: .audio).count == 1,
              abs(CMTimeGetSeconds(try await output.load(.duration)) - CMTimeGetSeconds(duration)) < 0.15 else { throw fail("Contrôle des pistes ou de durée échoué.") }
        complete = true; progress = 1
        status = "MP4 créé localement. Fidélité visuelle et audio à comparer, non certifiée."
        return final
    }
}
