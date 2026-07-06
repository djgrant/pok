// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "pok-trust",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "pok-trust", path: "Sources/PokTrust")
    ]
)
