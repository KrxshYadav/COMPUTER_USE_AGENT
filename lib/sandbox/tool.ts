import { tool } from "ai";
import { z } from "zod";
import { getDesktop } from "./utils";

const wait = async (seconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

export const resolution = { x: 1024, y: 768 };

const DISPLAY_ENV = { DISPLAY: ":99" };

// Map key names to X11 keysym names used by xdotool
const keyMap: Record<string, string> = {
  Return: "Return",
  enter: "Return",
  tab: "Tab",
  space: "space",
  backspace: "BackSpace",
  delete: "Delete",
  escape: "Escape",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  home: "Home",
  end: "End",
  pageup: "Prior",
  pagedown: "Next",
  f1: "F1",
  f2: "F2",
  f3: "F3",
  f4: "F4",
  f5: "F5",
  f6: "F6",
  f7: "F7",
  f8: "F8",
  f9: "F9",
  f10: "F10",
  f11: "F11",
  f12: "F12",
  shift: "Shift_L",
  control: "Control_L",
  ctrl: "Control_L",
  alt: "Alt_L",
  super: "Super_L",
  meta: "Super_L",
};

function mapKey(key: string): string {
  // Handle modifier combos like "ctrl+c" — xdotool supports this natively
  if (key.includes("+")) {
    return key
      .split("+")
      .map((part) => keyMap[part.toLowerCase()] || part)
      .join("+");
  }
  return keyMap[key.toLowerCase()] || keyMap[key] || key;
}

// Provider-agnostic schema for the computer tool. The original implementation
// relied on Anthropic's provider-defined `computer_20250124` tool, which Gemini
// cannot interpret. We declare the same action surface explicitly so any
// function-calling model (here: Gemini) can drive it.
const computerInputSchema = z.object({
  action: z
    .enum([
      "screenshot",
      "wait",
      "left_click",
      "double_click",
      "right_click",
      "mouse_move",
      "type",
      "key",
      "scroll",
      "left_click_drag",
    ])
    .describe("The computer action to perform."),
  // Coordinates are flat scalar fields, NOT arrays. Gemini's function-calling
  // schema rejects fixed-length array (tuple) parameters outright ("Unknown
  // name items"), and is more reliable filling discrete numbers than arrays of
  // primitives. Origin (0,0) is the top-left corner.
  x: z
    .number()
    .optional()
    .describe("X target pixel for click/move/drag actions, e.g. 512."),
  y: z
    .number()
    .optional()
    .describe("Y target pixel for click/move/drag actions, e.g. 384."),
  start_x: z
    .number()
    .optional()
    .describe("X start pixel for a left_click_drag action, e.g. 100."),
  start_y: z
    .number()
    .optional()
    .describe("Y start pixel for a left_click_drag action, e.g. 200."),
  text: z
    .string()
    .optional()
    .describe("Text to type, or the key/chord (e.g. 'ctrl+c') for key action."),
  duration: z
    .number()
    .optional()
    .describe("Seconds to wait for the wait action."),
  scroll_amount: z
    .number()
    .optional()
    .describe("Number of scroll clicks for the scroll action."),
  scroll_direction: z
    .enum(["up", "down", "left", "right"])
    .optional()
    .describe("Direction to scroll for the scroll action."),
});

type ComputerResult =
  | { type: "image"; data: string }
  | { type: "text"; text: string };

export const computerTool = (sandboxId: string) =>
  tool({
    description:
      `Use a mouse and keyboard to interact with a ${resolution.x}x${resolution.y} ` +
      "computer screen, and take screenshots. The origin (0,0) is the top-left " +
      "corner. Take a screenshot only when you need to see the current state to " +
      "decide where to click or type, or when the user asks for one — not after " +
      "every action.",
    inputSchema: computerInputSchema,
    execute: async ({
      action,
      x,
      y,
      text,
      duration,
      scroll_amount,
      scroll_direction,
      start_x,
      start_y,
    }): Promise<ComputerResult> => {
      const sandbox = await getDesktop(sandboxId);

      switch (action) {
        case "screenshot": {
          await sandbox.runCommand({
            cmd: "import",
            args: ["-window", "root", "/tmp/screenshot.png"],
            env: DISPLAY_ENV,
          });
          const buffer = await sandbox.readFileToBuffer({
            path: "/tmp/screenshot.png",
          });
          if (!buffer) throw new Error("Failed to read screenshot");
          const base64Data = buffer.toString("base64");
          return {
            type: "image" as const,
            data: base64Data,
          };
        }
        case "wait": {
          if (!duration) throw new Error("Duration required for wait action");
          const actualDuration = Math.min(duration, 2);
          await wait(actualDuration);
          return {
            type: "text" as const,
            text: `Waited for ${actualDuration} seconds`,
          };
        }
        case "left_click": {
          if (x === undefined || y === undefined)
            throw new Error("x and y required for left click action");
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["mousemove", "--sync", String(x), String(y), "click", "1"],
            env: DISPLAY_ENV,
          });
          return { type: "text" as const, text: `Left clicked at ${x}, ${y}` };
        }
        case "double_click": {
          if (x === undefined || y === undefined)
            throw new Error("x and y required for double click action");
          await sandbox.runCommand({
            cmd: "xdotool",
            args: [
              "mousemove",
              "--sync",
              String(x),
              String(y),
              "click",
              "--repeat",
              "2",
              "1",
            ],
            env: DISPLAY_ENV,
          });
          return {
            type: "text" as const,
            text: `Double clicked at ${x}, ${y}`,
          };
        }
        case "right_click": {
          if (x === undefined || y === undefined)
            throw new Error("x and y required for right click action");
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["mousemove", "--sync", String(x), String(y), "click", "3"],
            env: DISPLAY_ENV,
          });
          return {
            type: "text" as const,
            text: `Right clicked at ${x}, ${y}`,
          };
        }
        case "mouse_move": {
          if (x === undefined || y === undefined)
            throw new Error("x and y required for mouse move action");
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["mousemove", "--sync", String(x), String(y)],
            env: DISPLAY_ENV,
          });
          return { type: "text" as const, text: `Moved mouse to ${x}, ${y}` };
        }
        case "type": {
          if (!text) throw new Error("Text required for type action");
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["type", "--clearmodifiers", text],
            env: DISPLAY_ENV,
          });
          return { type: "text" as const, text: `Typed: ${text}` };
        }
        case "key": {
          if (!text) throw new Error("Key required for key action");
          const mappedKey = mapKey(text);
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["key", mappedKey],
            env: DISPLAY_ENV,
          });
          return { type: "text" as const, text: `Pressed key: ${text}` };
        }
        case "scroll": {
          if (!scroll_direction)
            throw new Error("Scroll direction required for scroll action");
          if (!scroll_amount)
            throw new Error("Scroll amount required for scroll action");
          // Button 4 = scroll up, button 5 = scroll down
          const button = scroll_direction === "up" ? "4" : "5";
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["click", "--repeat", String(scroll_amount), button],
            env: DISPLAY_ENV,
          });
          return {
            type: "text" as const,
            text: `Scrolled ${scroll_direction} by ${scroll_amount}`,
          };
        }
        case "left_click_drag": {
          if (
            start_x === undefined ||
            start_y === undefined ||
            x === undefined ||
            y === undefined
          )
            throw new Error(
              "start_x, start_y, x and y required for drag action",
            );
          await sandbox.runCommand({
            cmd: "xdotool",
            args: [
              "mousemove",
              String(start_x),
              String(start_y),
              "mousedown",
              "1",
              "mousemove",
              "--sync",
              String(x),
              String(y),
              "mouseup",
              "1",
            ],
            env: DISPLAY_ENV,
          });
          return {
            type: "text" as const,
            text: `Dragged mouse from ${start_x}, ${start_y} to ${x}, ${y}`,
          };
        }
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    },
    // Convert the tool output into the parts the model sees. Gemini accepts
    // image data inside a functionResponse (the AI SDK maps `image-data` to
    // Gemini `inlineData`), so screenshots are passed through as images.
    toModelOutput({ output }) {
      if (output.type === "image" && output.data) {
        return {
          type: "content",
          value: [
            {
              type: "image-data",
              data: output.data,
              mediaType: "image/png",
            },
          ],
        };
      }
      if (output.type === "text" && output.text) {
        return { type: "content", value: [{ type: "text", text: output.text }] };
      }
      throw new Error("Invalid result format");
    },
  });

export const bashTool = (sandboxId?: string) =>
  tool({
    description:
      "Run a bash command on the computer and return its stdout. Use this to " +
      "create files and folders or run any shell command. Prefer this tool " +
      "whenever it is viable for the task.",
    inputSchema: z.object({
      command: z.string().describe("The bash command to run."),
    }),
    execute: async ({ command }) => {
      const sandbox = await getDesktop(sandboxId);

      try {
        const result = await sandbox.runCommand({
          cmd: "bash",
          args: ["-c", command],
          env: DISPLAY_ENV,
        });
        const stdout = await result.stdout();
        return (
          stdout || "(Command executed successfully with no output)"
        );
      } catch (error) {
        console.error("Bash command failed:", error);
        if (error instanceof Error) {
          return `Error executing command: ${error.message}`;
        } else {
          return `Error executing command: ${String(error)}`;
        }
      }
    },
  });
