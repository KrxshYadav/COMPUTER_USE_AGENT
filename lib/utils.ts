import { UIMessage } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ABORTED = "User aborted";

export const prunedMessages = (messages: UIMessage[]): UIMessage[] => {
  if (messages.at(-1)?.role === "assistant") {
    return messages;
  }

  return messages.map((message) => {
    // Redact completed screenshot results from history to save input tokens.
    // In AI SDK v6, tool parts are typed as `tool-<name>` with input/output.
    message.parts = message.parts.map((part) => {
      if (
        part.type === "tool-computer" &&
        part.state === "output-available" &&
        (part.input as { action?: string } | undefined)?.action === "screenshot"
      ) {
        return {
          ...part,
          output: {
            type: "text",
            text: "Image redacted to save input tokens",
          },
        };
      }
      return part;
    });
    return message;
  });
};
