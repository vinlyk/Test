import SwiftUI

struct ScanView: View {
    @ObservedObject var engine: ScanEngine
    var onScanComplete: (ScanSession) -> Void

    @EnvironmentObject private var settings: AppSettings
    @State private var selectedType: ScanType = .quick
    @State private var customPath: String = ""
    @State private var showPathPicker: Bool = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            Divider()

            if engine.isScanning {
                scanningProgressView
            } else {
                scanSetupView
            }
        }
        .navigationTitle("Scan")
    }

    // MARK: - Header

    private var headerView: some View {
        HStack {
            Image(systemName: "shield.lefthalf.filled")
                .font(.largeTitle)
                .foregroundStyle(.blue)
            VStack(alignment: .leading) {
                Text("MacAV Scanner")
                    .font(.title2.bold())
                Text("Powered by ClamAV — \(engine.threats.count) threats detected")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding()
    }

    // MARK: - Setup

    private var scanSetupView: some View {
        VStack(spacing: 24) {
            Spacer()

            // Scan type cards
            HStack(spacing: 16) {
                ForEach(ScanType.allCases, id: \.self) { type in
                    ScanTypeCard(type: type, isSelected: selectedType == type) {
                        selectedType = type
                    }
                }
            }
            .padding(.horizontal)

            // Custom path picker
            if selectedType == .custom {
                HStack {
                    TextField("Path to scan...", text: $customPath)
                        .textFieldStyle(.roundedBorder)
                    Button("Browse") {
                        pickFolder()
                    }
                }
                .padding(.horizontal, 40)
            }

            // Start button
            Button {
                Task {
                    let path = selectedType == .custom ? customPath : nil
                    let session = await engine.startScan(type: selectedType, customPath: path)
                    onScanComplete(session)
                }
            } label: {
                Label("Start Scan", systemImage: "play.fill")
                    .font(.headline)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
            .disabled(selectedType == .custom && customPath.isEmpty)

            if let error = engine.errorMessage {
                Text(error)
                    .foregroundStyle(.red)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Spacer()
        }
    }

    // MARK: - Progress

    private var scanningProgressView: some View {
        VStack(spacing: 20) {
            Spacer()

            ProgressView()
                .scaleEffect(1.5)
                .padding()

            Text("Scanning \(selectedType.rawValue)...")
                .font(.headline)

            VStack(spacing: 8) {
                HStack {
                    Text("Files scanned:")
                    Spacer()
                    Text("\(engine.filesScanned)")
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                HStack {
                    Text("Threats found:")
                    Spacer()
                    Text("\(engine.threats.count)")
                        .monospacedDigit()
                        .foregroundStyle(engine.threats.isEmpty ? .secondary : .red)
                        .bold(engine.threats.count > 0)
                }
            }
            .frame(maxWidth: 300)

            if !engine.currentFile.isEmpty {
                Text(engine.currentFile)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .frame(maxWidth: 500)
            }

            Button("Cancel Scan", role: .destructive) {
                engine.cancelScan()
            }
            .buttonStyle(.bordered)

            Spacer()
        }
    }

    // MARK: - Helpers

    private func pickFolder() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            customPath = url.path
        }
    }
}

// MARK: - Scan Type Card

struct ScanTypeCard: View {
    let type: ScanType
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                Image(systemName: iconName)
                    .font(.largeTitle)
                    .foregroundStyle(isSelected ? .white : .blue)
                Text(type.rawValue)
                    .font(.headline)
                    .foregroundStyle(isSelected ? .white : .primary)
                Text(type.targetDescription)
                    .font(.caption)
                    .foregroundStyle(isSelected ? .white.opacity(0.8) : .secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? Color.blue : Color(nsColor: .controlBackgroundColor))
                    .shadow(radius: isSelected ? 4 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var iconName: String {
        switch type {
        case .quick:  return "bolt.shield"
        case .full:   return "shield.checkered"
        case .custom: return "folder.badge.questionmark"
        }
    }
}
