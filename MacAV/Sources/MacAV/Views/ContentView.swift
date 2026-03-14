import SwiftUI

enum NavItem: String, CaseIterable, Hashable {
    case scan       = "Scan"
    case results    = "Results"
    case quarantine = "Quarantine"
    case settings   = "Settings"

    var icon: String {
        switch self {
        case .scan:       return "shield.lefthalf.filled"
        case .results:    return "exclamationmark.triangle"
        case .quarantine: return "lock.shield"
        case .settings:   return "gearshape"
        }
    }
}

struct ContentView: View {
    @StateObject private var settings       = AppSettings()
    @StateObject private var quarantine     = QuarantineManager()
    @StateObject private var signatureUpdater: SignatureUpdater

    // Scan engine and session state lifted here so Results tab always has data
    @StateObject private var scanEngine: ScanEngine
    @State private var lastSession: ScanSession? = nil
    @State private var selection: NavItem = .scan
    @State private var showFDAAlert: Bool = false

    init() {
        let s = AppSettings()
        _settings = StateObject(wrappedValue: s)
        _scanEngine = StateObject(wrappedValue: ScanEngine(settings: s))
        _signatureUpdater = StateObject(wrappedValue: SignatureUpdater(settings: s))
    }

    var body: some View {
        NavigationSplitView {
            List(NavItem.allCases, id: \.self, selection: $selection) { item in
                Label(item.rawValue, systemImage: item.icon)
                    .badge(item == .quarantine ? quarantine.records.count : 0)
            }
            .navigationSplitViewColumnWidth(min: 160, ideal: 180)
            .listStyle(.sidebar)

            Spacer()

            // Status bar at bottom of sidebar
            VStack(alignment: .leading, spacing: 4) {
                Divider()
                HStack {
                    Circle()
                        .fill(definitionsColor)
                        .frame(width: 8, height: 8)
                    Text("Definitions: \(signatureUpdater.lastUpdatedFormatted)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 8)
            }
        } detail: {
            switch selection {
            case .scan:
                ScanView(
                    engine: scanEngine,
                    onScanComplete: { session in
                        lastSession = session
                        selection = .results
                    }
                )
                .environmentObject(settings)

            case .results:
                ResultsView(session: lastSession, quarantineManager: quarantine)

            case .quarantine:
                QuarantineView(manager: quarantine)

            case .settings:
                SettingsView(updater: signatureUpdater)
                    .environmentObject(settings)
            }
        }
        .onAppear {
            checkFullDiskAccess()
        }
        .alert("Full Disk Access Required", isPresented: $showFDAAlert) {
            Button("Open System Settings") {
                NSWorkspace.shared.open(
                    URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")!
                )
            }
            Button("Later", role: .cancel) {}
        } message: {
            Text("MacAV needs Full Disk Access to scan all files on your Mac.\n\nGo to System Settings → Privacy & Security → Full Disk Access and enable MacAV.")
        }
        .frame(minWidth: 800, minHeight: 500)
    }

    private var definitionsColor: Color {
        guard let d = signatureUpdater.lastUpdated else { return .red }
        let daysSince = Date().timeIntervalSince(d) / 86400
        return daysSince < 3 ? .green : daysSince < 7 ? .orange : .red
    }

    /// Detect if FDA is granted by trying to read a Safari-protected file.
    private func checkFullDiskAccess() {
        let testPath = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Safari/History.db").path
        if !FileManager.default.isReadableFile(atPath: testPath) {
            showFDAAlert = true
        }
    }
}
