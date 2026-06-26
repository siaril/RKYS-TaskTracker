// Single source for notification wording, shared by the in-app bell and the email
// digest so the two channels never drift. Plain module — safe on client and server.

const MESSAGES: Record<string, string> = {
  TASK_ASSIGNED: "assigned you a task",
  MENTIONED_IN_DESCRIPTION: "mentioned you in a task",
  MENTIONED_IN_COMMENT: "mentioned you in a comment",
  COMMENT_ON_ASSIGNED_TASK: "commented on a task assigned to you",
  COMMENT_ON_OWNED_TASK: "commented on your task",
};

/** The verb phrase for a notification type, e.g. "assigned you a task". */
export function notificationMessage(type: string): string {
  return MESSAGES[type] ?? "sent you a notification";
}
