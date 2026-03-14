import SwiftUI

@main
struct MacAVApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified)
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About MacAV") {
                    NSApp.orderFrontStandardAboutPanel(
                        options: [
                            .applicationName: "MacAV",
                            .credits: NSAttributedString(
                                string: "Powered by ClamAV — Open-source antivirus engine\n8.7M+ virus & malware signatures",
                                attributes: [.font: NSFont.systemFont(ofSize: 11)]
                            )
                        ]
                    )
                }
            }
        }
    }
}
