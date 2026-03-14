import Foundation

/// The action taken (or to be taken) on a detected threat.
enum ThreatStatus: String, Codable {
    case detected   // Found, no action taken yet
    case quarantined
    case ignored
    case deleted
}

/// Represents a single detected threat from a scan.
struct ThreatInfo: Identifiable, Codable, Hashable {
    let id: UUID
    let filePath: String
    let threatName: String
    var status: ThreatStatus
    let detectedAt: Date

    init(filePath: String, threatName: String) {
        self.id = UUID()
        self.filePath = filePath
        self.threatName = threatName
        self.status = .detected
        self.detectedAt = Date()
    }

    /// Short filename extracted from the full path.
    var fileName: String {
        URL(fileURLWithPath: filePath).lastPathComponent
    }

    /// Human-readable detected-at string.
    var detectedAtFormatted: String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: detectedAt)
    }
}
