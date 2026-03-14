import Foundation
import SwiftUI

/// Persistent app settings backed by UserDefaults / @AppStorage.
final class AppSettings: ObservableObject {

    // MARK: - ClamAV paths
    @AppStorage("clamavPath")   var clamavPath: String   = "/opt/homebrew/bin/clamscan"
    @AppStorage("freshclamPath") var freshclamPath: String = "/opt/homebrew/bin/freshclam"

    // MARK: - Scan exclusions (stored as comma-separated string)
    @AppStorage("exclusions") private var exclusionsRaw: String = ""

    var exclusions: [String] {
        get { exclusionsRaw.split(separator: ",").map(String.init).filter { !$0.isEmpty } }
        set { exclusionsRaw = newValue.joined(separator: ",") }
    }

    // MARK: - Timestamps
    @AppStorage("lastScanDate")   var lastScanDate: Double   = 0
    @AppStorage("lastUpdateDate") var lastUpdateDate: Double = 0

    var lastScanFormatted: String   { formattedDate(lastScanDate) }
    var lastUpdateFormatted: String { formattedDate(lastUpdateDate) }

    // MARK: - App support directories
    static var appSupportDir: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("MacAV")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static var quarantineDir: URL {
        let dir = appSupportDir.appendingPathComponent("Quarantine")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static var dbDir: URL {
        let dir = appSupportDir.appendingPathComponent("db")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static var freshclamConf: URL {
        appSupportDir.appendingPathComponent("freshclam.conf")
    }

    static var quarantineManifest: URL {
        appSupportDir.appendingPathComponent("quarantine_manifest.json")
    }

    // MARK: - Helpers
    private func formattedDate(_ ts: Double) -> String {
        guard ts > 0 else { return "Never" }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: Date(timeIntervalSince1970: ts))
    }
}
