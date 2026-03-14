import Foundation

enum ScanType: String, Codable, CaseIterable {
    case quick  = "Quick Scan"
    case full   = "Full Scan"
    case custom = "Custom Scan"

    var description: String { rawValue }

    var targetDescription: String {
        switch self {
        case .quick:  return "~/Downloads, ~/Desktop, ~/Applications"
        case .full:   return "Entire filesystem (/)"
        case .custom: return "User-selected directory"
        }
    }
}

/// Stats captured at the end of a scan.
struct ScanStats: Codable {
    var filesScanned: Int = 0
    var threatsFound: Int = 0
    var durationSeconds: TimeInterval = 0
}

/// One complete scan session record.
struct ScanSession: Identifiable, Codable {
    let id: UUID
    let scanType: ScanType
    let startedAt: Date
    var completedAt: Date?
    var stats: ScanStats
    var threats: [ThreatInfo]
    var customPath: String?

    init(scanType: ScanType, customPath: String? = nil) {
        self.id = UUID()
        self.scanType = scanType
        self.startedAt = Date()
        self.stats = ScanStats()
        self.threats = []
        self.customPath = customPath
    }

    var durationFormatted: String {
        guard let completed = completedAt else { return "In progress" }
        let seconds = Int(completed.timeIntervalSince(startedAt))
        if seconds < 60 { return "\(seconds)s" }
        return "\(seconds / 60)m \(seconds % 60)s"
    }

    var startedAtFormatted: String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: startedAt)
    }
}
