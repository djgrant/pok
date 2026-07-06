// Approval prompt: a non-activating floating NSPanel near the top-center of
// the active screen. One panel at a time; additional forwards queue FIFO.
// Unanswered panels auto-deny at 100s (inside the daemon's 110s timeout).

import AppKit
import LocalAuthentication

protocol ApprovalControllerDelegate: AnyObject {
    func approvalController(_ controller: ApprovalController, didDecide decision: String, id: String, reason: String)
    func approvalControllerPendingCountDidChange(_ controller: ApprovalController)
}

final class ApprovalController {
    private struct Forward {
        let id: String
        let request: ApprovalRequestBody
        let reason: String
    }

    weak var delegate: ApprovalControllerDelegate?

    private var queue: [Forward] = []
    private var current: Forward?
    private var panel: NSPanel?
    private var timeoutTimer: Timer?
    private var allowButton: NSButton?
    private var denyButton: NSButton?

    var pendingCount: Int { queue.count + (current == nil ? 0 : 1) }

    func enqueue(id: String, request: ApprovalRequestBody, reason: String) {
        queue.append(Forward(id: id, request: request, reason: reason))
        showNextIfIdle()
        delegate?.approvalControllerPendingCountDidChange(self)
    }

    /// Connection dropped: pokd falls back to its local approver chain, so
    /// pending panels are moot. Close everything without answering.
    func cancelAll() {
        queue.removeAll()
        current = nil
        closePanel()
        delegate?.approvalControllerPendingCountDidChange(self)
    }

    // MARK: - Panel lifecycle

    private func showNextIfIdle() {
        guard current == nil, !queue.isEmpty else { return }
        current = queue.removeFirst()
        presentPanel(for: current!)
        timeoutTimer = Timer.scheduledTimer(withTimeInterval: 100, repeats: false) { [weak self] _ in
            self?.finish(decision: "deny", reason: "timed out waiting for user")
        }
    }

    private func finish(decision: String, reason: String) {
        guard let forward = current else { return }
        current = nil
        closePanel()
        delegate?.approvalController(self, didDecide: decision, id: forward.id, reason: reason)
        delegate?.approvalControllerPendingCountDidChange(self)
        showNextIfIdle()
    }

    private func closePanel() {
        timeoutTimer?.invalidate()
        timeoutTimer = nil
        panel?.orderOut(nil)
        panel = nil
        allowButton = nil
        denyButton = nil
    }

    // MARK: - Actions

    @objc private func denyTapped() {
        finish(decision: "deny", reason: "denied by user")
    }

    @objc private func allowTapped() {
        guard let forward = current else { return }
        allowButton?.isEnabled = false
        denyButton?.isEnabled = false

        let context = LAContext()
        var error: NSError?
        var policy = LAPolicy.deviceOwnerAuthenticationWithBiometrics
        if !context.canEvaluatePolicy(policy, error: &error) {
            policy = .deviceOwnerAuthentication
            if !context.canEvaluatePolicy(policy, error: &error) {
                finish(decision: "deny", reason: "no authentication available")
                return
            }
        }
        let biometric = policy == .deviceOwnerAuthenticationWithBiometrics
        context.evaluatePolicy(policy, localizedReason: forward.reason) { [weak self] success, _ in
            DispatchQueue.main.async {
                guard let self, self.current?.id == forward.id else { return }
                if success {
                    self.finish(decision: "allow", reason: biometric ? "approved via touch id" : "approved via device owner auth")
                } else {
                    self.finish(decision: "deny", reason: "authentication failed or cancelled")
                }
            }
        }
    }

    // MARK: - Panel construction

    private func presentPanel(for forward: Forward) {
        let request = forward.request
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 16, left: 20, bottom: 16, right: 20)

        stack.addArrangedSubview(label("pok Trust — secret access request",
                                       font: .systemFont(ofSize: 11, weight: .semibold),
                                       color: .secondaryLabelColor))

        stack.addArrangedSubview(label(request.command, font: .monospacedSystemFont(ofSize: 15, weight: .bold)))

        let repoRow = NSStackView()
        repoRow.orientation = .horizontal
        repoRow.spacing = 8
        repoRow.addArrangedSubview(label(request.repoBasename, font: .systemFont(ofSize: 12), color: .secondaryLabelColor))
        if let env = request.env {
            repoRow.addArrangedSubview(badge(env))
        }
        stack.addArrangedSubview(repoRow)

        let keys = request.keys.isEmpty ? "(no keys listed)" : request.keys.joined(separator: ", ")
        stack.addArrangedSubview(label("Keys: \(keys)", font: .monospacedSystemFont(ofSize: 11, weight: .regular),
                                       color: .secondaryLabelColor))

        if request.initiator == "agent" {
            stack.addArrangedSubview(label("⚠ requested by an agent",
                                           font: .systemFont(ofSize: 13, weight: .bold),
                                           color: .systemOrange))
        } else {
            stack.addArrangedSubview(label("requested by: \(request.initiator)",
                                           font: .systemFont(ofSize: 11),
                                           color: .secondaryLabelColor))
        }

        let deny = NSButton(title: "Deny", target: self, action: #selector(denyTapped))
        deny.bezelStyle = .rounded
        let allow = NSButton(title: "Allow with Touch ID", target: self, action: #selector(allowTapped))
        allow.bezelStyle = .rounded
        allow.keyEquivalent = "\r"
        denyButton = deny
        allowButton = allow

        let buttons = NSStackView(views: [NSView(), deny, allow])
        buttons.orientation = .horizontal
        buttons.spacing = 8
        stack.addArrangedSubview(buttons)
        buttons.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -40).isActive = true

        let effect = NSVisualEffectView()
        effect.material = .hudWindow
        effect.state = .active
        effect.wantsLayer = true
        effect.layer?.cornerRadius = 12
        effect.translatesAutoresizingMaskIntoConstraints = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        effect.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: effect.topAnchor),
            stack.bottomAnchor.constraint(equalTo: effect.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: effect.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: effect.trailingAnchor),
            effect.widthAnchor.constraint(greaterThanOrEqualToConstant: 380),
        ])

        let panel = NSPanel(contentRect: .zero,
                            styleMask: [.nonactivatingPanel, .borderless],
                            backing: .buffered, defer: false)
        panel.isReleasedWhenClosed = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isFloatingPanel = true
        panel.becomesKeyOnlyIfNeeded = true
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = true
        panel.contentView = effect
        panel.setContentSize(effect.fittingSize)

        if let screen = NSScreen.main ?? NSScreen.screens.first {
            let frame = screen.visibleFrame
            let size = panel.frame.size
            panel.setFrameOrigin(NSPoint(x: frame.midX - size.width / 2,
                                         y: frame.maxY - size.height - 24))
        }
        panel.orderFrontRegardless()
        self.panel = panel
    }

    private func label(_ text: String, font: NSFont, color: NSColor = .labelColor) -> NSTextField {
        let field = NSTextField(wrappingLabelWithString: text)
        field.font = font
        field.textColor = color
        field.preferredMaxLayoutWidth = 400
        return field
    }

    private func badge(_ text: String) -> NSView {
        let field = NSTextField(labelWithString: text.uppercased())
        field.font = .systemFont(ofSize: 11, weight: .bold)
        field.textColor = .white
        let container = NSView()
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor.systemPurple.cgColor
        container.layer?.cornerRadius = 5
        field.translatesAutoresizingMaskIntoConstraints = false
        container.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(field)
        NSLayoutConstraint.activate([
            field.topAnchor.constraint(equalTo: container.topAnchor, constant: 2),
            field.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -2),
            field.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 7),
            field.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -7),
        ])
        return container
    }
}
