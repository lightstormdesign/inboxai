import { HUMAN_AGENT_WINDOW_MS, STANDARD_WINDOW_MS } from "./config";

export type MessagingWindow = "standard" | "human_agent" | "closed";

/** Which Meta messaging window a DM reply falls into, based on the customer's last message. */
export function messagingWindow(lastInboundAt: Date | null, now = Date.now()): MessagingWindow {
  if (!lastInboundAt) return "closed";
  const age = now - lastInboundAt.getTime();
  if (age <= STANDARD_WINDOW_MS) return "standard";
  if (age <= HUMAN_AGENT_WINDOW_MS) return "human_agent";
  return "closed";
}
