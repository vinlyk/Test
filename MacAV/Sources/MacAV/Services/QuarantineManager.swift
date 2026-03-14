import Foundation

/// A single item in the quarantine manifest.
struct QuarantineRecord: Identifiable, Codable {
    let id: UUID
    let originalPath: String
    let quarantinedFileName: String  // UUID-based filename stored in quarantine dir
    let threatName: String
    let quarantinedAt: Date

    var quarantinedAtFormatted: String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: quarantinedAt)
    }

    var originalFileName: String {
        URL(fileURLWithPath: originalPath).lastPathComponent
    }

    var quarantinedURL: URL {
        AppSettings.quarantineDir.appendingPathComponent(quarantinedFileName)
    }
}

/// Manages moving, restoring, and deleting quarantined files.
@MainActor
final class QuarantineManager: ObservableObject {

    @Published var records: [QuarantineRecord] = []

    private let fm = FileManager.default

    init() {
        loadManifest()
    }

    // MARK: - Public API

    /// Move a detected threat to the quarantine directory.
    func quarantine(threat: ThreatInfo) throws {
        let src = URL(fileURLWithPath: threat.filePath)
        guard fm.fileExists(atPath: src.path) else {
            throw QuarantineError.sourceNotFound(threat.filePath)
        }

        let ext = src.pathExtension
        let destName = UUID().uuidString + (ext.isEmpty ? "" : ".\(ext)")
        let dest = AppSettings.quarantineDir.appendingPathComponent(destName)

        try fm.moveItem(at: src, to: dest)

        // Restrict permissions so file cannot execute
        try fm.setAttributes([.posixPermissions: 0o000], ofItemAtPath: dest.path)

        let record = QuarantineRecord(
            id: UUID(),
            originalPath: threat.filePath,
            quarantinedFileName: destName,
            threatName: threat.threatName,
            quarantinedAt: Date()
        )
        records.append(record)
        saveManifest()
    }

    /// Restore a quarantined file to its original location.
    func restore(record: QuarantineRecord) throws {
        let src = record.quarantinedURL
        guard fm.fileExists(atPath: src.path) else {
            throw QuarantineError.sourceNotFound(src.path)
        }

        let dest = URL(fileURLWithPath: record.originalPath)
        let destDir = dest.deletingLastPathComponent()
        if !fm.fileExists(atPath: destDir.path) {
            try fm.createDirectory(at: destDir, withIntermediateDirectories: true)
        }

        // Restore read permissions so we can move it
        try fm.setAttributes([.posixPermissions: 0o644], ofItemAtPath: src.path)
        try fm.moveItem(at: src, to: dest)

        records.removeAll { $0.id == record.id }
        saveManifest()
    }

    /// Permanently delete a quarantined file.
    func delete(record: QuarantineRecord) throws {
        let src = record.quarantinedURL
        if fm.fileExists(atPath: src.path) {
            // Restore minimal permissions to allow deletion
            try? fm.setAttributes([.posixPermissions: 0o644], ofItemAtPath: src.path)
            try fm.removeItem(at: src)
        }
        records.removeAll { $0.id == record.id }
        saveManifest()
    }

    // MARK: - Persistence

    private func loadManifest() {
        let url = AppSettings.quarantineManifest
        guard fm.fileExists(atPath: url.path),
              let data = try? Data(contentsOf: url),
              let loaded = try? JSONDecoder().decode([QuarantineRecord].self, from: data)
        else { return }
        records = loaded
    }

    private func saveManifest() {
        let url = AppSettings.quarantineManifest
        if let data = try? JSONEncoder().encode(records) {
            try? data.write(to: url, options: .atomic)
        }
    }
}

enum QuarantineError: LocalizedError {
    case sourceNotFound(String)

    var errorDescription: String? {
        switch self {
        case .sourceNotFound(let path):
            return "File not found: \(path)"
        }
    }
}
