import Foundation
import Combine

/// Drives a clamscan subprocess and publishes real-time progress.
@MainActor
final class ScanEngine: ObservableObject {

    // MARK: - Published state
    @Published var isScanning: Bool = false
    @Published var currentFile: String = ""
    @Published var filesScanned: Int = 0
    @Published var threats: [ThreatInfo] = []
    @Published var errorMessage: String? = nil

    // MARK: - Private
    private var process: Process?
    private let settings: AppSettings

    init(settings: AppSettings) {
        self.settings = settings
    }

    // MARK: - Public API

    /// Start a scan of the given type. Optionally provide a custom path for `.custom`.
    func startScan(type: ScanType, customPath: String? = nil) async -> ScanSession {
        guard !isScanning else { return ScanSession(scanType: type) }

        isScanning = true
        currentFile = ""
        filesScanned = 0
        threats = []
        errorMessage = nil

        var session = ScanSession(scanType: type, customPath: customPath)
        let targets = scanTargets(for: type, customPath: customPath)
        let clamscan = settings.clamavPath
        let dbPath = AppSettings.dbDir.path
        let quarantineDir = AppSettings.quarantineDir.path
        let exclusions = settings.exclusions

        let args = buildArguments(
            targets: targets,
            dbPath: dbPath,
            quarantineDir: quarantineDir,
            exclusions: exclusions
        )

        let pipe = Pipe()
        let errPipe = Pipe()
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: clamscan)
        proc.arguments = args
        proc.standardOutput = pipe
        proc.standardError = errPipe
        self.process = proc

        do {
            try proc.run()
        } catch {
            errorMessage = "Failed to launch clamscan: \(error.localizedDescription)\n\nMake sure ClamAV is installed: brew install clamav"
            isScanning = false
            return session
        }

        // Read stdout asynchronously line by line
        let handle = pipe.fileHandleForReading
        var buffer = Data()

        while proc.isRunning || handle.availableData.count > 0 {
            let chunk = handle.availableData
            if chunk.isEmpty {
                try? await Task.sleep(nanoseconds: 50_000_000) // 50ms
                continue
            }
            buffer.append(chunk)
            while let newline = buffer.firstIndex(of: UInt8(ascii: "\n")) {
                let lineData = buffer[buffer.startIndex...newline]
                buffer = buffer[buffer.index(after: newline)...]
                if let line = String(data: lineData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !line.isEmpty {
                    processLine(line, session: &session)
                }
            }
        }

        // Drain remaining
        let remaining = handle.readDataToEndOfFile()
        buffer.append(remaining)
        for line in String(data: buffer, encoding: .utf8)?
            .components(separatedBy: "\n")
            .map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) })
            ?? [] {
            if !line.isEmpty { processLine(line, session: &session) }
        }

        proc.waitUntilExit()

        session.completedAt = Date()
        session.stats.filesScanned = filesScanned
        session.stats.threatsFound = threats.count
        session.stats.durationSeconds = session.completedAt!.timeIntervalSince(session.startedAt)
        session.threats = threats

        isScanning = false
        return session
    }

    /// Cancel any running scan.
    func cancelScan() {
        process?.terminate()
        isScanning = false
    }

    // MARK: - Helpers

    private func scanTargets(for type: ScanType, customPath: String?) -> [String] {
        switch type {
        case .quick:
            let home = FileManager.default.homeDirectoryForCurrentUser.path
            return [
                "\(home)/Downloads",
                "\(home)/Desktop",
                "\(home)/Documents",
                "/Applications"
            ]
        case .full:
            return ["/"]
        case .custom:
            return [customPath ?? FileManager.default.homeDirectoryForCurrentUser.path]
        }
    }

    private func buildArguments(
        targets: [String],
        dbPath: String,
        quarantineDir: String,
        exclusions: [String]
    ) -> [String] {
        var args: [String] = [
            "--recursive",
            "--infected",          // Only print infected files
            "--no-summary",        // We parse output manually
            "--database=\(dbPath)"
        ]

        // Exclude system directories on full scan
        let defaultExclusions = [
            "^/proc", "^/sys", "^/dev",
            "^/System/Volumes/Data/private/var/vm",
            "^/private/var/vm"
        ]
        for excl in (defaultExclusions + exclusions) {
            args.append("--exclude-dir=\(excl)")
        }

        args.append(contentsOf: targets)
        return args
    }

    /// Parse a single line of clamscan stdout output.
    private func processLine(_ line: String, session: inout ScanSession) {
        // Threat line: "/path/to/file: ThreatName FOUND"
        if line.hasSuffix(" FOUND") {
            let withoutFound = String(line.dropLast(6)) // remove " FOUND"
            if let colonRange = withoutFound.range(of: ": ", options: .backwards) {
                let path = String(withoutFound[withoutFound.startIndex..<colonRange.lowerBound])
                let threat = String(withoutFound[colonRange.upperBound...])
                let info = ThreatInfo(filePath: path, threatName: threat)
                threats.append(info)
                filesScanned += 1
                currentFile = path
            }
        } else if line.contains(": ") && !line.hasPrefix("---") {
            // Progress line: "/path/to/file: OK" or scan status
            if let colonRange = line.range(of: ": ") {
                let path = String(line[line.startIndex..<colonRange.lowerBound])
                if path.hasPrefix("/") {
                    filesScanned += 1
                    currentFile = path
                }
            }
        }
    }
}
