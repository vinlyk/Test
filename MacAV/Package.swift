// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MacAV",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "MacAV",
            path: "Sources/MacAV",
            resources: []
        ),
        .testTarget(
            name: "MacAVTests",
            dependencies: ["MacAV"],
            path: "Tests/MacAVTests"
        )
    ]
)
