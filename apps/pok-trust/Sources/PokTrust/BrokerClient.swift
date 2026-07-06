// Long-lived NDJSON client for the pokd unix socket.
// Registers as the approver frontend and reconnects with backoff (1s..30s).

import Foundation
import Network

protocol BrokerClientDelegate: AnyObject {
    // All delegate callbacks are delivered on the main queue.
    func brokerStatusDidChange(_ status: BrokerClient.Status)
    func brokerDidReceiveForward(id: String, request: ApprovalRequestBody, reason: String)
    func brokerConnectionDidDrop()
}

final class BrokerClient {
    enum Status: Equatable {
        case waiting     // not connected; retrying with backoff
        case connected   // registered with pokd
        case replaced    // another frontend took over; not retrying
    }

    weak var delegate: BrokerClientDelegate?
    private(set) var status: Status = .waiting

    private let socketPath: String
    private let queue = DispatchQueue(label: "pok-trust.broker")
    private var connection: NWConnection?
    private var buffer = Data()
    private var backoff: TimeInterval = 1
    private var replaced = false
    private var generation = 0

    init() {
        let raw = ProcessInfo.processInfo.environment["POK_BROKER_SOCKET"] ?? "~/.pok/pokd.sock"
        socketPath = (raw as NSString).expandingTildeInPath
    }

    func start() {
        queue.async { self.connect() }
    }

    /// Clears a `replaced` state and reconnects immediately.
    func reconnectNow() {
        queue.async {
            self.replaced = false
            self.backoff = 1
            self.connection?.cancel()
            self.connect()
        }
    }

    func send(decision: String, id: String, reason: String) {
        queue.async {
            guard let connection = self.connection, self.status == .connected else { return }
            let message = ResultMessage(id: id, decision: decision, reason: reason)
            guard var data = try? JSONEncoder().encode(message) else { return }
            data.append(0x0A)
            connection.send(content: data, completion: .contentProcessed { _ in })
        }
    }

    // MARK: - Connection lifecycle (broker queue)

    private func connect() {
        guard !replaced else { return }
        generation += 1
        let gen = generation
        buffer.removeAll()

        let connection = NWConnection(to: .unix(path: socketPath), using: .tcp)
        self.connection = connection
        connection.stateUpdateHandler = { [weak self] state in
            self?.queue.async {
                guard let self, gen == self.generation else { return }
                switch state {
                case .ready:
                    self.register(on: connection)
                    self.receive(on: connection, gen: gen)
                case .failed, .waiting:
                    // .waiting (e.g. socket file absent) never resolves for unix
                    // sockets in practice; treat it as a failed attempt.
                    self.dropAndRetry()
                default:
                    break
                }
            }
        }
        connection.start(queue: queue)
    }

    private func register(on connection: NWConnection) {
        guard var data = try? JSONEncoder().encode(RegisterMessage()) else { return }
        data.append(0x0A)
        connection.send(content: data, completion: .contentProcessed { _ in })
    }

    private func receive(on connection: NWConnection, gen: Int) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            self?.queue.async {
                guard let self, gen == self.generation else { return }
                if let data, !data.isEmpty {
                    self.buffer.append(data)
                    self.drainLines()
                }
                if isComplete || error != nil {
                    self.dropAndRetry()
                } else {
                    self.receive(on: connection, gen: gen)
                }
            }
        }
    }

    private func drainLines() {
        while let newline = buffer.firstIndex(of: 0x0A) {
            let line = buffer.subdata(in: buffer.startIndex..<newline)
            buffer.removeSubrange(buffer.startIndex...newline)
            guard !line.isEmpty else { continue }
            handle(line: line)
        }
    }

    private func handle(line: Data) {
        guard let message = try? JSONDecoder().decode(IncomingMessage.self, from: line) else {
            NSLog("pok-trust: ignoring malformed message from pokd")
            return
        }
        switch message.type {
        case "frontend.registered":
            backoff = 1
            setStatus(.connected)
        case "frontend.replaced":
            replaced = true
            connection?.cancel()
            connection = nil
            setStatus(.replaced)
        case "approval.forward":
            guard let id = message.id, let request = message.request else {
                NSLog("pok-trust: approval.forward missing id/request")
                return
            }
            let reason = message.reason ?? "pok requests secret access"
            DispatchQueue.main.async {
                self.delegate?.brokerDidReceiveForward(id: id, request: request, reason: reason)
            }
        default:
            break // unknown message types are ignored per protocol
        }
    }

    private func dropAndRetry() {
        connection?.cancel()
        connection = nil
        if status == .connected {
            DispatchQueue.main.async { self.delegate?.brokerConnectionDidDrop() }
        }
        setStatus(replaced ? .replaced : .waiting)
        guard !replaced else { return }
        let delay = backoff
        backoff = min(backoff * 2, 30)
        queue.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.connection == nil else { return }
            self.connect()
        }
    }

    private func setStatus(_ new: Status) {
        guard status != new else { return }
        status = new
        DispatchQueue.main.async { self.delegate?.brokerStatusDidChange(new) }
    }
}
