// Menu bar app: status item, connection status, launch-at-login, quit.

import AppKit
import ServiceManagement

final class AppDelegate: NSObject, NSApplicationDelegate, BrokerClientDelegate, ApprovalControllerDelegate {
    private var statusItem: NSStatusItem!
    private let statusMenuItem = NSMenuItem(title: "Waiting for pokd…", action: nil, keyEquivalent: "")
    private let reconnectMenuItem = NSMenuItem(title: "Reconnect", action: #selector(reconnect), keyEquivalent: "")
    private let loginMenuItem = NSMenuItem(title: "Launch at Login", action: #selector(toggleLaunchAtLogin), keyEquivalent: "")

    private let broker = BrokerClient()
    private let approvals = ApprovalController()

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        updateIcon()

        let menu = NSMenu()
        statusMenuItem.isEnabled = false
        reconnectMenuItem.target = self
        reconnectMenuItem.isHidden = true
        loginMenuItem.target = self
        menu.addItem(statusMenuItem)
        menu.addItem(reconnectMenuItem)
        menu.addItem(.separator())
        menu.addItem(loginMenuItem)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit pok Trust", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        menu.autoenablesItems = false
        statusItem.menu = menu
        updateLoginItemState()

        broker.delegate = self
        approvals.delegate = self
        broker.start()
    }

    // MARK: - BrokerClientDelegate

    func brokerStatusDidChange(_ status: BrokerClient.Status) {
        switch status {
        case .connected:
            statusMenuItem.title = "Connected to pokd"
        case .waiting:
            statusMenuItem.title = "Waiting for pokd…"
        case .replaced:
            statusMenuItem.title = "Replaced by another frontend"
        }
        reconnectMenuItem.isHidden = status != .replaced
        updateIcon()
    }

    func brokerDidReceiveForward(id: String, request: ApprovalRequestBody, reason: String) {
        approvals.enqueue(id: id, request: request, reason: reason)
    }

    func brokerConnectionDidDrop() {
        // pokd falls back to its local approver chain for anything pending.
        approvals.cancelAll()
    }

    // MARK: - ApprovalControllerDelegate

    func approvalController(_ controller: ApprovalController, didDecide decision: String, id: String, reason: String,
                            grantTTLSeconds: Double?) {
        broker.send(decision: decision, id: id, reason: reason, grantTTLSeconds: grantTTLSeconds)
    }

    func approvalControllerPendingCountDidChange(_ controller: ApprovalController) {
        updateIcon()
    }

    // MARK: - Menu actions

    @objc private func reconnect() {
        broker.reconnectNow()
    }

    @objc private func toggleLaunchAtLogin() {
        do {
            if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            NSLog("pok-trust: launch at login toggle failed: \(error.localizedDescription)")
        }
        updateLoginItemState()
    }

    private func updateLoginItemState() {
        loginMenuItem.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }

    private func updateIcon() {
        let pending = approvals.pendingCount > 0
        let name = pending ? "shield.fill" : "shield"
        let image = NSImage(systemSymbolName: name, accessibilityDescription: "pok Trust")
        image?.isTemplate = true
        statusItem.button?.image = image
        statusItem.button?.appearsDisabled = broker.status != .connected
    }
}
