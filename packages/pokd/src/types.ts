export interface ApprovalRequestBody {
  repo: string;
  command: string;
  task: string;
  keys: string[];
  context: Record<string, unknown>;
  initiator: 'human' | 'agent';
  pid?: number;
  /** Access level requested (protocol v1.2). Absent means "read". */
  access?: 'read' | 'write';
}

export interface ApprovalRequest {
  v: 1;
  type: 'approval.request';
  id: string;
  request: ApprovalRequestBody;
}

export interface ApprovalResponse {
  v: 1;
  type: 'approval.response';
  id: string;
  decision: 'allow' | 'deny';
  reason?: string;
}

/** Sent by an approver frontend to claim the frontend role (protocol v1.1). */
export interface FrontendRegister {
  v: 1;
  type: 'frontend.register';
  name: string;
}

/** Daemon acknowledgement of a frontend registration. */
export interface FrontendRegistered {
  v: 1;
  type: 'frontend.registered';
}

/** Sent to the old frontend connection when a new frontend registers. */
export interface FrontendReplaced {
  v: 1;
  type: 'frontend.replaced';
}

/** Daemon → frontend: an approval request awaiting a human decision. */
export interface ApprovalForward {
  v: 1;
  type: 'approval.forward';
  id: string;
  request: ApprovalRequestBody;
  reason: string;
}

/** Standing grant attached to an allow result (protocol v1.2). */
export interface ApprovalResultGrant {
  ttlSeconds: number;
}

/** Frontend → daemon: the human's decision on a forwarded request. */
export interface ApprovalResult {
  v: 1;
  type: 'approval.result';
  id: string;
  decision: 'allow' | 'deny';
  reason?: string;
  /** Optional standing grant: "allow this and equivalent requests for a while". */
  grant?: ApprovalResultGrant;
}

export interface ApproverResult {
  decision: 'allow' | 'deny';
  reason: string;
  /** Which approver produced the decision, e.g. "touch-id", "osascript", "stdin", "auto-deny" */
  approver: string;
}

export type Approver = (request: ApprovalRequestBody) => Promise<ApproverResult>;
