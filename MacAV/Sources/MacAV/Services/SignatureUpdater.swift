import Foundation
import SwiftUI

/// Manages ClamAV virus definition updates via freshclam.
@MainActor
final class SignatureUpdater: ObservableObject {

    @Published var isUpdating: Bool = false
    @Published var updateLog: String = ""
    @Published var updateError: String? = nil
    @Published var lastUpdated: Date? = nil

    private let settings: AppSettings

    init(settings: AppSettings) {
        self.settings = settings
        refreshLastUpdatedDate()
    }

    // MARK: - Public API

    /// Run freshclam to download the latest virus databases.
    func updateDefinitions() async {
        guard !isUpdating else { return }
        isUpdating = true
        updateLog = ""
        updateError = nil

        let confPath = AppSettings.freshclamConf.path
        ensureFreshclamConf(at: confPath)

        let freshclam = settings.freshclamPath
        let args = [
            "--config-file=\(confPath)",
            "--datadir=\(AppSettings.dbDir.path)"
        ]

        let pipe = Pipe()
        let errPipe = Pipe()
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: freshclam)
        proc.arguments = args
        proc.standardOutput = pipe
        proc.standardError = errPipe

        do {
            try proc.run()
        } catch {
            updateError = "Failed to launch freshclam at '\(freshclam)'.\n\nInstall ClamAV: brew install clamav"
            isUpdating = false
            return
        }

        let handle = pipe.fileHandleForReading
        var buffer = Data()

        while proc.isRunning || handle.availableData.count > 0 {
            let chunk = handle.availableData
            if chunk.isEmpty {
                try? await Task.sleep(nanoseconds: 100_000_000)
                continue
            }
            buffer.append(chunk)
            while let newline = buffer.firstIndex(of: UInt8(ascii: "\n")) {
                let lineData = buffer[buffer.startIndex...newline]
                buffer = buffer[buffer.index(after: newline)...]
                if let line = String(data: lineData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !line.isEmpty {
                    updateLog += line + "\n"
                }
            }
        }

        // Drain stderr for error details
        let errData = errPipe.fileHandleForReading.readDataToEndOfFile()
        if let errText = String(data: errData, encoding: .utf8), !errText.isEmpty {
            updateLog += errText
        }

        proc.waitUntilExit()

        if proc.terminationStatus == 0 || proc.terminationStatus == 1 {
            // Exit 1 = already up-to-date, which is fine
            settings.lastUpdateDate = Date().timeIntervalSince1970
            refreshLastUpdatedDate()
        } else {
            updateError = "freshclam exited with code \(proc.terminationStatus).\n\nCheck the log for details."
        }

        isUpdating = false
    }

    /// Read the modification date of daily.cvd to show when defs were last updated.
    func refreshLastUpdatedDate() {
        let daily = AppSettings.dbDir.appendingPathComponent("daily.cvd")
        let daily2 = AppSettings.dbDir.appendingPathComponent("daily.cld")
        let candidate = FileManager.default.fileExists(atPath: daily.path) ? daily : daily2
        if let attrs = try? FileManager.default.attributesOfItem(atPath: candidate.path),
           let mod = attrs[.modificationDate] as? Date {
            lastUpdated = mod
        } else if settings.lastUpdateDate > 0 {
            lastUpdated = Date(timeIntervalSince1970: settings.lastUpdateDate)
        }
    }

    var lastUpdatedFormatted: String {
        guard let d = lastUpdated else { return "Never" }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: d)
    }

    // MARK: - Private

    /// Generate a minimal freshclam.conf pointing to our db directory.
    private func ensureFreshclamConf(at path: String) {
        guard !FileManager.default.fileExists(atPath: path) else { return }
        let dbDir = AppSettings.dbDir.path
        let conf = """
        DatabaseDirectory \(dbDir)
        UpdateLogFile /tmp/freshclam.log
        DatabaseMirror database.clamav.net
        DatabaseMirror db.local.clamav.net
        MaxAttempts 3
        NotifyClamd no
        """
        try? conf.write(toFile: path, atomically: true, encoding: .utf8)
    }
}
