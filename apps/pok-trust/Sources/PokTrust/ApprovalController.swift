// Approval prompt: a non-activating floating NSPanel centered on the screen
// with the mouse pointer (slightly above center, like a system auth dialog).
// Touch ID is armed immediately when the panel appears, so the happy path is
// a single touch — no clicks. The Touch ID prompt is embedded in the panel
// via LAAuthenticationView (LocalAuthenticationEmbeddedUI, macOS 12+), so no
// separate system auth dialog appears in the biometric path. One panel at a time; additional forwards queue
// FIFO. Unanswered panels auto-deny at 100s (inside the daemon's 110s timeout).

import AppKit
import LocalAuthentication
import LocalAuthenticationEmbeddedUI

/// Always-on one-line diagnostics appended to ~/.pok/pok-trust.log. A few
/// lines per approval; never logs secret values (only command/repo/keys/env
/// metadata, which the audit log already records).
enum TrustLog {
    private static let url: URL = {
        let dir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".pok", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("pok-trust.log")
    }()

    private static let timestamp: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static func log(_ message: String) {
        let line = "\(timestamp.string(from: Date())) \(message)\n"
        guard let data = line.data(using: .utf8) else { return }
        if let handle = try? FileHandle(forWritingTo: url) {
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: data)
        } else {
            try? data.write(to: url)
        }
    }
}

/// The approval panel must be able to become key: LAAuthenticationView only
/// arms the Touch ID sensor when its window is key. Borderless panels return
/// false from canBecomeKey by default, so override it. The panel stays
/// .nonactivatingPanel — taking key status does not activate the app, so the
/// user's terminal keeps focus at the app level.
private final class ApprovalPanel: NSPanel {
    override var canBecomeKey: Bool { true }
}

protocol ApprovalControllerDelegate: AnyObject {
    func approvalController(_ controller: ApprovalController, didDecide decision: String, id: String, reason: String,
                            grantTTLSeconds: Double?)
    func approvalControllerPendingCountDidChange(_ controller: ApprovalController)
}

final class ApprovalController {
    private struct Forward {
        let id: String
        let request: ApprovalRequestBody
        let reason: String
    }

    /// Authentication state for the panel currently on screen.
    private enum AuthState {
        case touchArmed       // biometric evaluation in flight (auto or retry)
        case touchFailed      // biometric rejected/cancelled; offer retry
        case passwordOffered  // no biometrics available; offer password auth
        case passwordInFlight // .deviceOwnerAuthentication evaluation running
    }

    weak var delegate: ApprovalControllerDelegate?

    private var queue: [Forward] = []
    private var current: Forward?
    private var panel: NSPanel?
    private var timeoutTimer: Timer?
    private var authState: AuthState = .touchArmed
    private var authContext: LAContext?
    private var keyMonitor: Any?

    private var headerContainer: NSView?
    private var statusLabel: NSTextField?
    private var primaryButton: NSButton?
    private var denyButton: NSButton?
    private var grantCheckbox: NSButton?

    /// Standing-grant TTL issued when the "Remember" checkbox is on: 8 hours.
    private static let grantTTLSeconds: Double = 28800

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
        // Standing grant: only on allow, and only if the user opted in via the
        // checkbox for this specific request (state is read before the panel —
        // and the checkbox with it — is torn down).
        let grantTTL: Double? = (decision == "allow" && grantCheckbox?.state == .on)
            ? Self.grantTTLSeconds : nil
        current = nil
        closePanel()
        TrustLog.log("decision sent id=\(forward.id) decision=\(decision) reason=\(reason)"
            + (grantTTL != nil ? " grant=8h" : ""))
        delegate?.approvalController(self, didDecide: decision, id: forward.id, reason: reason,
                                     grantTTLSeconds: grantTTL)
        delegate?.approvalControllerPendingCountDidChange(self)
        showNextIfIdle()
    }

    private func closePanel() {
        timeoutTimer?.invalidate()
        timeoutTimer = nil
        authContext?.invalidate()
        authContext = nil
        if let monitor = keyMonitor {
            NSEvent.removeMonitor(monitor)
            keyMonitor = nil
        }
        if panel != nil { TrustLog.log("panel closed") }
        panel?.orderOut(nil)
        panel = nil
        headerContainer = nil
        statusLabel = nil
        primaryButton = nil
        denyButton = nil
        grantCheckbox = nil
    }

    // MARK: - Authentication state machine

    /// Called once when the panel appears: arm Touch ID immediately when
    /// biometrics are available; otherwise offer password auth (no auto-launch
    /// of the password dialog).
    private func startAuthentication(for forward: Forward) {
        let probe = LAContext()
        var error: NSError?
        let canBiometrics = probe.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        TrustLog.log("canEvaluatePolicy(biometrics)=\(canBiometrics)"
            + (error.map { " error=\($0.localizedDescription) (code \($0.code))" } ?? ""))
        if canBiometrics {
            evaluateBiometrics(for: forward)
        } else {
            applyState(.passwordOffered)
        }
    }

    /// One biometric evaluation; failure moves to .touchFailed (retry button)
    /// instead of auto-denying or looping. An LAContext is single-evaluation,
    /// so every attempt (initial arm or retry) gets a fresh context plus a
    /// fresh LAAuthenticationView bound to it — evaluating a policy on the
    /// context the view wraps renders the Touch ID prompt inside our panel
    /// instead of the standard system alert.
    ///
    /// Ordering matters: the view is installed in the (already visible, key)
    /// panel first, and evaluatePolicy is deferred to the next runloop turn so
    /// the view is attached to a visible key window when the sensor arms —
    /// arming before the view is on screen leaves the sensor dead.
    private func evaluateBiometrics(for forward: Forward) {
        // Re-probe at arm time: biometrics can become unavailable between
        // retries (e.g. lockout after repeated failures). Fall back to the
        // password path rather than silently sitting armed.
        let probe = LAContext()
        var probeError: NSError?
        guard probe.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &probeError) else {
            TrustLog.log("canEvaluatePolicy(biometrics)=false at arm time"
                + (probeError.map { " error=\($0.localizedDescription) (code \($0.code))" } ?? ""))
            applyState(.passwordOffered)
            return
        }

        let context = LAContext()
        authContext = context
        setHeader(LAAuthenticationView(context: context, controlSize: .large))
        applyState(.touchArmed)

        // Arm on the next runloop turn, after the view has been laid out in
        // the visible key panel.
        DispatchQueue.main.async { [weak self] in
            guard let self, self.current?.id == forward.id, self.authContext === context else { return }
            TrustLog.log("evaluatePolicy(biometrics) started id=\(forward.id)")
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                                   localizedReason: forward.reason) { [weak self] success, error in
                DispatchQueue.main.async {
                    guard let self, self.current?.id == forward.id, self.authContext === context else { return }
                    self.authContext = nil
                    if success {
                        TrustLog.log("evaluatePolicy(biometrics) success id=\(forward.id)")
                        self.finish(decision: "allow", reason: "approved via touch id")
                        return
                    }
                    let laCode = (error as? LAError)?.code
                    TrustLog.log("evaluatePolicy(biometrics) failed id=\(forward.id)"
                        + " error=\(error?.localizedDescription ?? "unknown")"
                        + " laCode=\(laCode.map { String($0.rawValue) } ?? "none")")
                    switch laCode {
                    case .biometryLockout:
                        // Too many failed attempts: Touch ID is locked until
                        // the password is entered, so offer the password path.
                        self.applyState(.passwordOffered)
                    case .userCancel, .systemCancel, .appCancel:
                        // Deny-ish, but not an explicit Deny: offer a retry.
                        self.applyState(.touchFailed)
                    default:
                        // Rejected finger, or biometry becoming unavailable
                        // mid-flight: offer a manual retry.
                        self.applyState(.touchFailed)
                    }
                }
            }
        }
    }

    /// Password fallback (.deviceOwnerAuthentication) cannot be embedded:
    /// this uses a fresh LAContext with no LAAuthenticationView attached, so
    /// the system password sheet appears — expected and acceptable here.
    private func evaluatePassword(for forward: Forward) {
        applyState(.passwordInFlight)
        let context = LAContext()
        authContext = context
        TrustLog.log("evaluatePolicy(deviceOwnerAuthentication) started id=\(forward.id)")
        context.evaluatePolicy(.deviceOwnerAuthentication,
                               localizedReason: forward.reason) { [weak self] success, error in
            DispatchQueue.main.async {
                guard let self, self.current?.id == forward.id, self.authContext === context else { return }
                self.authContext = nil
                if success {
                    TrustLog.log("evaluatePolicy(deviceOwnerAuthentication) success id=\(forward.id)")
                    self.finish(decision: "allow", reason: "approved via device owner auth")
                } else {
                    TrustLog.log("evaluatePolicy(deviceOwnerAuthentication) failed id=\(forward.id)"
                        + " error=\(error?.localizedDescription ?? "unknown")")
                    self.applyState(.passwordOffered)
                }
            }
        }
    }

    private func applyState(_ state: AuthState) {
        authState = state
        switch state {
        case .touchArmed:
            // Header already holds the live LAAuthenticationView installed by
            // evaluateBiometrics; the embedded prompt is the affordance.
            statusLabel?.stringValue = "Touch ID to allow"
            primaryButton?.isHidden = true
            primaryButton?.isEnabled = false
            denyButton?.isEnabled = true
        case .touchFailed:
            // The failed context (and its view) is spent; show a static
            // dimmed symbol until a retry rebuilds a fresh context + view.
            setHeader(staticTouchIDIcon(tint: .secondaryLabelColor))
            statusLabel?.stringValue = "Touch ID was not recognized"
            primaryButton?.title = "Retry Touch ID"
            primaryButton?.isHidden = false
            primaryButton?.isEnabled = true
            denyButton?.isEnabled = true
        case .passwordOffered:
            setHeader(staticTouchIDIcon(tint: .secondaryLabelColor))
            statusLabel?.stringValue = "Touch ID is unavailable"
            primaryButton?.title = "Enter Password…"
            primaryButton?.isHidden = false
            primaryButton?.isEnabled = true
            denyButton?.isEnabled = true
        case .passwordInFlight:
            statusLabel?.stringValue = "Waiting for authentication…"
            primaryButton?.isEnabled = false
            denyButton?.isEnabled = true
        }
    }

    /// Swap the panel's header content (embedded Touch ID view or static
    /// fallback symbol) inside the fixed-size header container.
    private func setHeader(_ view: NSView) {
        guard let container = headerContainer else { return }
        container.subviews.forEach { $0.removeFromSuperview() }
        view.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(view)
        NSLayoutConstraint.activate([
            view.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            view.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            view.widthAnchor.constraint(lessThanOrEqualTo: container.widthAnchor),
            view.heightAnchor.constraint(lessThanOrEqualTo: container.heightAnchor),
        ])
    }

    private func staticTouchIDIcon(tint: NSColor) -> NSImageView {
        let config = NSImage.SymbolConfiguration(pointSize: 44, weight: .regular)
        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: "touchid", accessibilityDescription: "Touch ID")?
            .withSymbolConfiguration(config)
        icon.contentTintColor = tint
        return icon
    }

    // MARK: - Actions

    @objc private func denyTapped() {
        finish(decision: "deny", reason: "denied by user")
    }

    /// Retry Touch ID or Enter Password…, depending on the current state.
    @objc private func primaryTapped() {
        guard let forward = current, primaryButton?.isEnabled == true else { return }
        switch authState {
        case .touchFailed:
            evaluateBiometrics(for: forward)
        case .passwordOffered:
            evaluatePassword(for: forward)
        case .touchArmed, .passwordInFlight:
            break
        }
    }

    /// Local key monitor: Esc denies, Return triggers the visible fallback
    /// button. Only fires for events delivered to this app (i.e. if the user
    /// clicked the panel), so it never captures typing in other apps; all
    /// other keys pass through untouched.
    private func installKeyMonitor() {
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self, self.panel != nil else { return event }
            switch event.keyCode {
            case 53: // Esc
                self.denyTapped()
                return nil
            case 36, 76: // Return / keypad Enter
                if self.primaryButton?.isHidden == false, self.primaryButton?.isEnabled == true {
                    self.primaryTapped()
                    return nil
                }
                return event
            default:
                return event
            }
        }
    }

    // MARK: - Panel construction

    private func presentPanel(for forward: Forward) {
        let request = forward.request
        let contentWidth: CGFloat = 400

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = 6
        stack.edgeInsets = NSEdgeInsets(top: 20, left: 24, bottom: 18, right: 24)

        // Touch ID header: a fixed-size container that hosts the embedded
        // LAAuthenticationView while a biometric evaluation is armed (the
        // fingerprint prompt lives inside this panel — no separate system
        // dialog), or a static dimmed symbol otherwise. Content is installed
        // by evaluateBiometrics / applyState via setHeader.
        let header = NSView()
        header.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            header.widthAnchor.constraint(equalToConstant: contentWidth - 48),
            header.heightAnchor.constraint(equalToConstant: 64),
        ])
        headerContainer = header
        stack.addArrangedSubview(header)

        let status = label("Touch ID to allow", font: .systemFont(ofSize: 15, weight: .semibold))
        status.alignment = .center
        statusLabel = status
        stack.addArrangedSubview(status)
        stack.setCustomSpacing(14, after: status)

        // Context card: command, repo, env badge, keys, initiator.
        let card = NSStackView()
        card.orientation = .vertical
        card.alignment = .leading
        card.spacing = 6
        card.edgeInsets = NSEdgeInsets(top: 12, left: 14, bottom: 12, right: 14)

        card.addArrangedSubview(label("pok Trust — secret access request",
                                      font: .systemFont(ofSize: 11, weight: .semibold),
                                      color: .secondaryLabelColor))

        card.addArrangedSubview(label(request.command, font: .monospacedSystemFont(ofSize: 15, weight: .bold)))

        let repoRow = NSStackView()
        repoRow.orientation = .horizontal
        repoRow.spacing = 8
        repoRow.addArrangedSubview(label(request.repoBasename, font: .systemFont(ofSize: 12), color: .secondaryLabelColor))
        if let env = request.env {
            repoRow.addArrangedSubview(badge(env))
        }
        card.addArrangedSubview(repoRow)

        let keys = request.keys.isEmpty ? "(no keys listed)" : request.keys.joined(separator: ", ")
        card.addArrangedSubview(label("Keys: \(keys)", font: .monospacedSystemFont(ofSize: 11, weight: .regular),
                                      color: .secondaryLabelColor))

        if request.initiator == "agent" {
            card.addArrangedSubview(label("⚠ requested by an agent",
                                          font: .systemFont(ofSize: 13, weight: .bold),
                                          color: .systemOrange))
        } else {
            card.addArrangedSubview(label("requested by: \(request.initiator)",
                                          font: .systemFont(ofSize: 11),
                                          color: .secondaryLabelColor))
        }

        let cardBox = NSView()
        cardBox.wantsLayer = true
        cardBox.layer?.backgroundColor = NSColor.labelColor.withAlphaComponent(0.06).cgColor
        cardBox.layer?.cornerRadius = 8
        card.translatesAutoresizingMaskIntoConstraints = false
        cardBox.translatesAutoresizingMaskIntoConstraints = false
        cardBox.addSubview(card)
        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: cardBox.topAnchor),
            card.bottomAnchor.constraint(equalTo: cardBox.bottomAnchor),
            card.leadingAnchor.constraint(equalTo: cardBox.leadingAnchor),
            card.trailingAnchor.constraint(equalTo: cardBox.trailingAnchor),
        ])
        stack.addArrangedSubview(cardBox)
        cardBox.widthAnchor.constraint(equalToConstant: contentWidth - 48).isActive = true
        stack.setCustomSpacing(10, after: cardBox)

        // Standing-grant opt-in: unobtrusive, defaults OFF, rebuilt fresh for
        // every forward (never sticky). Prod-flavored envs get a caution in
        // the label but stay selectable.
        let isProd = request.env == "prod" || request.env == "production"
        let grantTitle = isProd ? "Remember for 8 hours (prod!)" : "Remember for 8 hours"
        let grant = NSButton(checkboxWithTitle: grantTitle, target: nil, action: nil)
        grant.state = .off
        grant.attributedTitle = NSAttributedString(string: grantTitle, attributes: [
            .font: NSFont.systemFont(ofSize: 13),
            .foregroundColor: NSColor.secondaryLabelColor,
        ])
        grantCheckbox = grant

        let grantRow = NSStackView(views: [grant, NSView()])
        grantRow.orientation = .horizontal
        stack.addArrangedSubview(grantRow)
        grantRow.widthAnchor.constraint(equalToConstant: contentWidth - 48).isActive = true
        stack.setCustomSpacing(10, after: grantRow)

        let deny = NSButton(title: "Deny", target: self, action: #selector(denyTapped))
        deny.bezelStyle = .rounded
        denyButton = deny
        let primary = NSButton(title: "Retry Touch ID", target: self, action: #selector(primaryTapped))
        primary.bezelStyle = .rounded
        primary.keyEquivalent = "\r"
        primary.isHidden = true
        primaryButton = primary

        let buttons = NSStackView(views: [NSView(), deny, primary])
        buttons.orientation = .horizontal
        buttons.spacing = 8
        stack.addArrangedSubview(buttons)
        buttons.widthAnchor.constraint(equalToConstant: contentWidth - 48).isActive = true

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
            effect.widthAnchor.constraint(equalToConstant: contentWidth),
        ])

        let panel = ApprovalPanel(contentRect: .zero,
                                  styleMask: [.nonactivatingPanel, .borderless],
                                  backing: .buffered, defer: false)
        panel.isReleasedWhenClosed = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isFloatingPanel = true
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = true
        panel.contentView = effect
        panel.setContentSize(effect.fittingSize)

        // Show first, then take key status: LAAuthenticationView only arms
        // the sensor inside a visible key window. makeKey() (not
        // makeKeyAndOrderFront) plus .nonactivatingPanel keeps the app from
        // activating, so the user's terminal keeps focus at the app level.
        position(panel)
        panel.orderFrontRegardless()
        panel.makeKey()
        self.panel = panel
        TrustLog.log("panel shown id=\(forward.id) command=\(request.command)"
            + " repo=\(request.repoBasename) keys=\(request.keys.joined(separator: ","))"
            + " env=\(request.env ?? "-") isKey=\(panel.isKeyWindow)")

        installKeyMonitor()
        startAuthentication(for: forward)
    }

    /// Center on the screen containing the mouse pointer (fall back to
    /// NSScreen.main): horizontally centered, panel center at ~40% from the
    /// top — slightly above center, like a system auth dialog.
    private func position(_ panel: NSPanel) {
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) }
            ?? NSScreen.main ?? NSScreen.screens.first
        guard let frame = screen?.visibleFrame else { return }
        let size = panel.frame.size
        panel.setFrameOrigin(NSPoint(x: frame.midX - size.width / 2,
                                     y: frame.minY + frame.height * 0.60 - size.height / 2))
    }

    private func label(_ text: String, font: NSFont, color: NSColor = .labelColor) -> NSTextField {
        let field = NSTextField(wrappingLabelWithString: text)
        field.font = font
        field.textColor = color
        field.preferredMaxLayoutWidth = 340
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
