import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { notifications, notificationSettings } from "../db/schema";

let io: Server;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || "*" },
  });

  // Auth handshake: client connects with `{ auth: { token } }`, we join a
  // per-employee room so notifications can be pushed to exactly one user
  // instead of broadcasting to everyone.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("unauthorized"));
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number };
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`employee:${socket.data.userId}`);
  });

  return io;
}

// Call this from anywhere in the backend (compliance issue creation, badge
// auto-award, approval decisions, policy reminders) instead of talking to
// Socket.io directly -- it's the single place that (a) checks the toggle in
// Settings > Notification Settings, (b) writes the row so it survives a
// refresh, and (c) pushes it live if the user is connected.
export async function notify(params: {
  employeeId: number;
  type: "compliance_issue_raised" | "compliance_issue_overdue" | "approval_decision" | "policy_reminder" | "badge_unlock" | "kudos_received";
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
}) {
  const [settings] = await db.select().from(notificationSettings);
  const gate: Record<string, boolean> = {
    compliance_issue_raised: settings?.complianceAlerts ?? true,
    compliance_issue_overdue: settings?.complianceAlerts ?? true,
    approval_decision: settings?.approvalDecisions ?? true,
    policy_reminder: settings?.policyReminders ?? true,
    badge_unlock: settings?.badgeUnlocks ?? true,
    kudos_received: true,
  };
  if (!gate[params.type]) return;

  const [row] = await db.insert(notifications).values({
    employeeId: params.employeeId,
    type: params.type,
    message: params.message,
    relatedEntityType: params.relatedEntityType,
    relatedEntityId: params.relatedEntityId,
  }).returning();

  io?.to(`employee:${params.employeeId}`).emit("notification", row);
  return row;
}
