// pok-approve: Touch ID approval prompt for pokd.
// Usage: pok-approve "<reason string>"
// Exits 0 on approval, 1 on cancel/failure.

import Foundation
import LocalAuthentication

let reason = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "pok requests secret access"

let context = LAContext()
var error: NSError?

var policy = LAPolicy.deviceOwnerAuthenticationWithBiometrics
if !context.canEvaluatePolicy(policy, error: &error) {
    // Fall back to device owner auth (password / watch) if biometrics unavailable.
    policy = .deviceOwnerAuthentication
    if !context.canEvaluatePolicy(policy, error: &error) {
        FileHandle.standardError.write("pok-approve: no authentication available\n".data(using: .utf8)!)
        exit(1)
    }
}

let semaphore = DispatchSemaphore(value: 0)
var approved = false

context.evaluatePolicy(policy, localizedReason: reason) { success, evalError in
    approved = success
    if let evalError = evalError {
        FileHandle.standardError.write("pok-approve: \(evalError.localizedDescription)\n".data(using: .utf8)!)
    }
    semaphore.signal()
}

semaphore.wait()
exit(approved ? 0 : 1)
