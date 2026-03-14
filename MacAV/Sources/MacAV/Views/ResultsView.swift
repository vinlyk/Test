import SwiftUI

struct ResultsView: View {
    var session: ScanSession?
    @ObservedObject var quarantineManager: QuarantineManager

    @State private var errorAlert: String? = nil

    var body: some View {
        Group {
            if let session {
                resultsContent(session)
            } else {
                emptyState
            }
        }
        .navigationTitle("Scan Results")
        .alert("Error", isPresented: Binding(
            get: { errorAlert != nil },
            set: { if !$0 { errorAlert = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorAlert ?? "")
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("No Scan Results Yet")
                .font(.title2)
            Text("Run a scan from the Scan tab to see results here.")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Results content

    @ViewBuilder
    private func resultsContent(_ session: ScanSession) -> some View {
        VStack(spacing: 0) {
            // Summary bar
            summaryBar(session)

            Divider()

            if session.threats.isEmpty {
                cleanResult
            } else {
                threatList(session)
            }
        }
    }

    private func summaryBar(_ session: ScanSession) -> some View {
        HStack(spacing: 24) {
            statCell(label: "Files Scanned", value: "\(session.stats.filesScanned)", icon: "doc", color: .blue)
            statCell(label: "Threats Found", value: "\(session.threats.count)", icon: "exclamationmark.triangle", color: session.threats.isEmpty ? .green : .red)
            statCell(label: "Scan Type", value: session.scanType.rawValue, icon: "shield", color: .secondary)
            statCell(label: "Duration", value: session.durationFormatted, icon: "clock", color: .secondary)
            Spacer()
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private func statCell(label: String, value: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Label(label, systemImage: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
                .foregroundStyle(color)
        }
    }

    private var cleanResult: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)
            Text("No Threats Found")
                .font(.title2.bold())
            Text("Your system is clean.")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func threatList(_ session: ScanSession) -> some View {
        Table(session.threats) {
            TableColumn("File") { threat in
                VStack(alignment: .leading, spacing: 2) {
                    Text(threat.fileName)
                        .fontWeight(.medium)
                    Text(threat.filePath)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            TableColumn("Threat Name") { threat in
                Text(threat.threatName)
                    .foregroundStyle(.red)
                    .font(.callout.monospaced())
            }
            TableColumn("Detected") { threat in
                Text(threat.detectedAtFormatted)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            TableColumn("Action") { threat in
                HStack {
                    Button("Quarantine") {
                        quarantine(threat)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                    .disabled(threat.status != .detected)
                }
            }
            .width(120)
        }
    }

    // MARK: - Actions

    private func quarantine(_ threat: ThreatInfo) {
        Task { @MainActor in
            do {
                try quarantineManager.quarantine(threat: threat)
            } catch {
                errorAlert = error.localizedDescription
            }
        }
    }
}
