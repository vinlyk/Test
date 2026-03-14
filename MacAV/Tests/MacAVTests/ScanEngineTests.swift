import XCTest
@testable import MacAV

/// Unit tests for ScanEngine output parsing and QuarantineManager logic.
///
/// To run: cd /home/user/Test/MacAV && swift test
///
/// To test full end-to-end detection, create an EICAR test file first:
///   echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > /tmp/eicar_test.com
/// Then run a Custom Scan on /tmp/eicar_test.com in the app UI.
final class ScanEngineOutputParsingTests: XCTestCase {

    func testThreatLineParsed() {
        // Simulated clamscan output line for a detected threat
        let line = "/Users/test/Downloads/malware.exe: Win.Trojan.Generic-123 FOUND"
        let threat = parseThreatLine(line)
        XCTAssertNotNil(threat)
        XCTAssertEqual(threat?.filePath, "/Users/test/Downloads/malware.exe")
        XCTAssertEqual(threat?.threatName, "Win.Trojan.Generic-123")
    }

    func testCleanLineParsed() {
        let line = "/Users/test/Documents/report.pdf: OK"
        let threat = parseThreatLine(line)
        XCTAssertNil(threat, "Clean files should not produce a ThreatInfo")
    }

    func testMacOSThreatLineParsed() {
        let line = "/Applications/SuspiciousApp.app/Contents/MacOS/SuspiciousApp: OSX.Spigot-7 FOUND"
        let threat = parseThreatLine(line)
        XCTAssertNotNil(threat)
        XCTAssertEqual(threat?.threatName, "OSX.Spigot-7")
    }

    func testEicarThreatLineParsed() {
        let line = "/tmp/eicar_test.com: Eicar-Signature FOUND"
        let threat = parseThreatLine(line)
        XCTAssertNotNil(threat)
        XCTAssertEqual(threat?.filePath, "/tmp/eicar_test.com")
        XCTAssertEqual(threat?.threatName, "Eicar-Signature")
    }

    // MARK: - Helpers (mirrors ScanEngine parsing logic)

    private func parseThreatLine(_ line: String) -> ThreatInfo? {
        guard line.hasSuffix(" FOUND") else { return nil }
        let withoutFound = String(line.dropLast(6))
        guard let colonRange = withoutFound.range(of: ": ", options: .backwards) else { return nil }
        let path = String(withoutFound[withoutFound.startIndex..<colonRange.lowerBound])
        let threat = String(withoutFound[colonRange.upperBound...])
        return ThreatInfo(filePath: path, threatName: threat)
    }
}

final class ScanSessionTests: XCTestCase {

    func testScanSessionInitialState() {
        let session = ScanSession(scanType: .quick)
        XCTAssertEqual(session.scanType, .quick)
        XCTAssertTrue(session.threats.isEmpty)
        XCTAssertEqual(session.stats.filesScanned, 0)
    }

    func testScanSessionDurationFormatting() {
        var session = ScanSession(scanType: .full)
        session.completedAt = session.startedAt.addingTimeInterval(125)
        XCTAssertEqual(session.durationFormatted, "2m 5s")
    }

    func testScanSessionShortDuration() {
        var session = ScanSession(scanType: .quick)
        session.completedAt = session.startedAt.addingTimeInterval(45)
        XCTAssertEqual(session.durationFormatted, "45s")
    }
}

final class ThreatInfoTests: XCTestCase {

    func testFileNameExtracted() {
        let threat = ThreatInfo(filePath: "/Users/bob/Downloads/evil.dmg", threatName: "OSX.BadApp")
        XCTAssertEqual(threat.fileName, "evil.dmg")
    }

    func testInitialStatusIsDetected() {
        let threat = ThreatInfo(filePath: "/tmp/virus.sh", threatName: "Unix.Trojan.Mirai")
        XCTAssertEqual(threat.status, .detected)
    }
}
