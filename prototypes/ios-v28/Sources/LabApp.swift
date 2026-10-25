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
        .fileImporter(isPresented: $importing, allowedContentTypes: [.movie]) { result in
            Task { @MainActor in
                do { output = nil; output = try await renderer.run(input: result.get()) }
                catch { renderer.status = "Échec : \(error.localizedDescription)" }
            }
        }
    }
}
