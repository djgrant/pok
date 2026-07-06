// Wire types for the pokd trust-broker protocol (v1 + v1.1 frontend addendum).
// NDJSON over a unix socket; one JSON object per line.

import Foundation

/// Minimal JSON value for `context: Record<string, unknown>`.
enum JSONValue: Decodable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case null
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let b = try? container.decode(Bool.self) {
            self = .bool(b)
        } else if let n = try? container.decode(Double.self) {
            self = .number(n)
        } else if let s = try? container.decode(String.self) {
            self = .string(s)
        } else if let a = try? container.decode([JSONValue].self) {
            self = .array(a)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    /// Human-readable rendering for scalar values.
    var displayString: String? {
        switch self {
        case .string(let s): return s
        case .bool(let b): return b ? "true" : "false"
        case .number(let n):
            return n == n.rounded() ? String(Int(n)) : String(n)
        case .null, .array, .object: return nil
        }
    }
}

/// Mirrors ApprovalRequestBody in packages/pokd/src/types.ts.
struct ApprovalRequestBody: Decodable {
    let repo: String
    let command: String
    let task: String
    let keys: [String]
    let context: [String: JSONValue]?
    let initiator: String // "human" | "agent"
    let pid: Int?

    var repoBasename: String {
        (repo as NSString).lastPathComponent
    }

    var env: String? {
        context?["env"]?.displayString
    }
}

/// Loose envelope for any incoming daemon message.
struct IncomingMessage: Decodable {
    let type: String
    let id: String?
    let request: ApprovalRequestBody?
    let reason: String?
}

struct RegisterMessage: Encodable {
    let v = 1
    let type = "frontend.register"
    let name = "pok-trust"
}

struct ResultMessage: Encodable {
    let v = 1
    let type = "approval.result"
    let id: String
    let decision: String // "allow" | "deny"
    let reason: String
}
