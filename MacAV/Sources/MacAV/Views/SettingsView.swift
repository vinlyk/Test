import SwiftUI

struct SettingsView: View {
    @ObservedObject var updater: SignatureUpdater
    @EnvironmentObject private var settings: AppSettings

    @State private var newExclusion: String = ""

    var body: some View {
        Form {
            // MARK: - Virus Definitions
            Section("Virus Definitions") {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Last Updated")
                            .font(.headline)
                        Text(updater.lastUpdatedFormatted)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if updater.isUpdating {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Button("Update Now") {
                            Task { await updater.updateDefinitions() }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }

                if !updater.updateLog.isEmpty {
                    ScrollView {
                        Text(updater.updateLog)
                            .font(.caption.monospaced())
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(6)
                    }
                    .frame(height: 100)
                    .background(Color(nsColor: .textBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }

                if let error = updater.updateError {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.caption)
                }

                Text("Signatures from database.clamav.net — 8.7M+ virus/malware definitions including OSX-specific malware, trojans, phishing, and ransomware.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // MARK: - ClamAV Paths
            Section("ClamAV Binary Paths") {
                LabeledContent("clamscan path") {
                    TextField("e.g. /opt/homebrew/bin/clamscan", text: $settings.clamavPath)
                        .textFieldStyle(.roundedBorder)
                        .frame(maxWidth: 340)
                }
                LabeledContent("freshclam path") {
                    TextField("e.g. /opt/homebrew/bin/freshclam", text: $settings.freshclamPath)
                        .textFieldStyle(.roundedBorder)
                        .frame(maxWidth: 340)
                }
                Text("Default paths assume ClamAV was installed via Homebrew on Apple Silicon. Intel Macs use /usr/local/bin/.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // MARK: - Scan Exclusions
            Section("Scan Exclusions") {
                if settings.exclusions.isEmpty {
                    Text("No exclusions configured.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(settings.exclusions, id: \.self) { excl in
                        HStack {
                            Image(systemName: "minus.circle.fill")
                                .foregroundStyle(.red)
                                .onTapGesture { removeExclusion(excl) }
                            Text(excl)
                                .font(.callout.monospaced())
                            Spacer()
                        }
                    }
                }

                HStack {
                    TextField("Add exclusion path or regex...", text: $newExclusion)
                        .textFieldStyle(.roundedBorder)
                    Button("Add") {
                        addExclusion()
                    }
                    .disabled(newExclusion.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }

            // MARK: - Install Guide
            Section("Setup Guide") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Prerequisites")
                        .font(.headline)
                    Text("1. Install Homebrew: https://brew.sh")
                    Text("2. Install ClamAV:")
                    codeBlock("brew install clamav")
                    Text("3. Update virus definitions (click \"Update Now\" above)")
                    Text("4. Grant Full Disk Access in System Settings → Privacy & Security → Full Disk Access")
                }
                .font(.callout)
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Settings")
    }

    // MARK: - Helpers

    private func addExclusion() {
        let trimmed = newExclusion.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !settings.exclusions.contains(trimmed) else { return }
        settings.exclusions.append(trimmed)
        newExclusion = ""
    }

    private func removeExclusion(_ excl: String) {
        settings.exclusions.removeAll { $0 == excl }
    }

    private func codeBlock(_ text: String) -> some View {
        Text(text)
            .font(.caption.monospaced())
            .padding(6)
            .background(Color(nsColor: .textBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}
