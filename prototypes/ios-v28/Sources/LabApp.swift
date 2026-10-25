import SwiftUI
import UniformTypeIdentifiers
import AVKit

@main struct LabApp: App {
    var body: some Scene { WindowGroup { LabView() } }
}
struct LabView: View {
    @StateObject private var renderer = LocalRenderer()
    @State private var importing = false
    @State private var output: URL?
    var body: some View {
        VStack(spacing: 16) {
            Text("Social+ · laboratoire V28")
            Text("Test de compatibilité local, non validé visuellement.").font(.caption)
            renderer.webSurface.frame(width: 1, height: 1).accessibilityHidden(true)
            Button("Importer le rush de référence préparé") { importing = true }
                .disabled(renderer.busy)
            ProgressView(value: renderer.progress)
            Text(renderer.status).font(.caption)
            if let output {
                VideoPlayer(player: AVPlayer(url: output)).frame(height: 240)
                ShareLink("Partager le MP4", item: output)
            }
        }.padding()
        .task {
            guard ProcessInfo.processInfo.arguments.contains("--synthetic-ci") else { return }
            let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            var report: [String: Any] = ["synthetic": true, "physicalIPhone": false]
            do {
                guard let source = Bundle.main.url(forResource: "synthetic", withExtension: "mp4") else {
                    throw NSError(domain: "V28Lab", code: 2, userInfo: [NSLocalizedDescriptionKey: "Synthetic source missing"])
                }
                let started = Date()
                let result = try await renderer.run(input: source)
                let destination = documents.appendingPathComponent("SocialPlus-synthetic-iOS.mp4")
                try FileManager.default.copyItem(at: result, to: destination)
                output = destination
                report["success"] = true
                report["elapsedSeconds"] = Date().timeIntervalSince(started)
                report["file"] = destination.lastPathComponent
            } catch {
                report["success"] = false
                report["error"] = String(describing: error)
                report["description"] = error.localizedDescription
            }
            if let data = try? JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]) {
                try? data.write(to: documents.appendingPathComponent("ci-result.json"), options: .atomic)
            }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.movie]) { result in
            Task { @MainActor in
                do { output = nil; output = try await renderer.run(input: result.get()) }
                catch { renderer.status = "Échec : \(error.localizedDescription)" }
            }
        }
    }
}
