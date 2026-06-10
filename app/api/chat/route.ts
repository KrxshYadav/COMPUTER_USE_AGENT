
import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
} from "ai";
import { killDesktop } from "@/lib/sandbox/utils";
import { bashTool, computerTool } from "@/lib/sandbox/tool";
import { prunedMessages } from "@/lib/utils";

// Allow streaming responses up to 5 minutes
export const maxDuration = 300;

const SYSTEM_PROMPT = `You are an autonomous computer-use agent. You control a real desktop with a mouse and keyboard (via the \`computer\` tool) and a shell (via the \`bash\` tool). Your job is to fully complete the user's request end to end, not just the first step.

# Understand intent
The user speaks in casual, natural language and often uses shorthand. Infer what they mean and fill in the obvious steps yourself. Examples:
- "open yt" / "open youtube" → open the browser, go to youtube.com, wait for it to load.
- "search cats on youtube" → open youtube.com, click the search box, type "cats", press Enter.
- "google the weather" → open the browser, go to google.com, search "weather", press Enter.
Never ask the user to spell out every sub-step. If the request is a high-level goal, decompose it into the concrete actions needed and do them.

# Always finish the whole task (multi-step)
A single request usually requires MANY tool calls. Keep working autonomously until the entire goal is achieved. Do NOT stop after one action and wait for the user. For example, "open a tab, search youtube.com and hit enter" is THREE actions in sequence (open tab → type the URL → press Enter) — perform all of them before you finish.

# Screenshots: take them sparingly
Do NOT take a screenshot after every action just to confirm it worked. Only take a screenshot when:
- You genuinely need to SEE the screen to decide where to click or type (e.g. you don't know the coordinates of a button), OR
- The user explicitly asks you to take/show a screenshot.
When you already know what to do next (typing a URL you just focused, pressing Enter, etc.), just do it — no screenshot needed in between.

# Tools
- Prefer the \`bash\` tool whenever it can accomplish the task (creating files/folders, running commands) — it is faster and more reliable than clicking.
- Use the \`computer\` tool for anything that requires the GUI (browsing, clicking buttons, typing into web pages).
- To type into a field, click it first to focus it, then use the \`type\` action. To submit, use the \`key\` action with "Return"/"enter".

# Practical notes
- If the browser opens with a setup/welcome wizard, IGNORE it and proceed straight to the task (e.g. click the address bar and type the URL).
- Advise the user when a real wait is necessary (e.g. a page is still loading), then continue once it's ready.
- Only stop and report back when the goal is genuinely complete, or if you are truly blocked and need a decision from the user.`;

export async function POST(req: Request) {
  const { messages, sandboxId }: { messages: UIMessage[]; sandboxId: string } =
    await req.json();
  // Defined once so both streamText and convertToModelMessages share the same
  // `toModelOutput`, ensuring historical screenshots are converted to image
  // parts Gemini understands.
  const tools = {
    computer: computerTool(sandboxId),
    bash: bashTool(sandboxId),
  };
  try {
    const result = streamText({
      // Gemini drives the computer/bash tools via standard function calling.
      // `gemini-2.5-flash` is used (not `-lite`) because lite is too weak at
      // multi-step agentic planning: it tends to perform a single action and
      // then stop instead of carrying a task through to completion.
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(prunedMessages(messages), {
        tools,
      }),
      tools,
      // Keep the agent looping across tool calls (replaces the v4 client-side
      // `maxSteps`).
      stopWhen: stepCountIs(30),
    });

    // Create response stream
    const response = result.toUIMessageStreamResponse({
      onError(error) {
        console.error(error);
        return error instanceof Error ? error.message : String(error);
      },
    });

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    await killDesktop(sandboxId); // Force cleanup on error
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
