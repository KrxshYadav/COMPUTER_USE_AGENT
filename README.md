<a href="https://ai-sdk-computer-use.vercel.app">
  <h1 align="center">AI SDK Computer Use Demo</h1>
</a>

<p align="center">
  An open-source AI chatbot demonstrating computer use capabilities with Google Gemini, Vercel Sandboxes, and the AI SDK by Vercel.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#how-it-works"><strong>How It Works</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running Locally</strong></a>
</p>
<br/>

## Features

- Streaming text responses powered by the [AI SDK](https://sdk.vercel.ai/docs).
- Google Gemini 2.5 Flash driving `computer` and `bash` tools via function calling.
- Remote desktop environment running in a [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) with Chrome, a window manager, and VNC streaming.
- [shadcn/ui](https://ui.shadcn.com/) components for a modern, responsive UI powered by [Tailwind CSS](https://tailwindcss.com).
- Built with the latest [Next.js](https://nextjs.org) App Router.

## How It Works

The app spins up a Vercel Sandbox from a pre-built snapshot that includes:

- **Xvnc** — a virtual X11 display server
- **openbox** — a lightweight window manager
- **noVNC + websockify** — streams the desktop to the browser via WebSocket
- **Google Chrome** — auto-launched so the AI agent has a browser ready
- **xdotool + ImageMagick** — for mouse/keyboard control and screenshots

When a user sends a message, Gemini uses the `computer` tool (screenshot, click, type, scroll) and the `bash` tool (run shell commands) to interact with the sandbox desktop. The noVNC stream is displayed in a resizable iframe alongside the chat.

### Architecture

```
User ↔ Next.js Chat UI ↔ AI SDK ↔ Google Gemini 2.5 Flash
                                        ↓
                                  Vercel Sandbox
                              ┌─────────────────────┐
                              │  Xvnc (:99)         │
                              │  openbox             │
                              │  Chrome              │
                              │  websockify → noVNC  │
                              └─────────────────────┘
                                        ↓
                              noVNC iframe in browser
```

## Deploy Your Own

You can deploy your own version to Vercel by clicking the button below:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?project-name=AI+SDK+Computer+Use+Demo&repository-name=ai-sdk-computer-use&repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fai-sdk-computer-use&demo-title=AI+SDK+Computer+Use+Demo&demo-url=https%3A%2F%2Fai-sdk-computer-use.vercel.app%2F&demo-description=A+chatbot+application+built+with+Next.js+demonstrating+Google+Gemini+computer+use+capabilities+with+Vercel+Sandboxes&env=GOOGLE_GENERATIVE_AI_API_KEY,SANDBOX_SNAPSHOT_ID)

## Running Locally

### Prerequisites

- Node.js 18+
- A [Vercel](https://vercel.com) account (for Sandbox access)
- A [Google Generative AI API key](https://aistudio.google.com/apikey)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up Vercel credentials

Install the [Vercel CLI](https://vercel.com/docs/cli) and link your project:

```bash
pnpm install -g vercel
vercel link
vercel env pull
```

This creates a `.env.local` file with `VERCEL_OIDC_TOKEN` for Sandbox authentication.

Alternatively, set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` manually in your `.env.local`.

### 3. Create a sandbox snapshot

The snapshot pre-installs the desktop environment (Xvnc, Chrome, openbox, noVNC, xdotool, ImageMagick) so sandboxes boot in seconds.

```bash
npx tsx lib/sandbox/create-snapshot.ts
```

This takes ~10 minutes. When done, it outputs a snapshot ID. Add it to your `.env.local`:

```
SANDBOX_SNAPSHOT_ID=snap_xxxxxxxxxxxxx
```

### 4. Add your Google Generative AI API key

```
GOOGLE_GENERATIVE_AI_API_KEY=...
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to use the computer use agent.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Google Generative AI API key for Gemini |
| `SANDBOX_SNAPSHOT_ID` | Yes | Vercel Sandbox snapshot with the desktop environment |
| `VERCEL_OIDC_TOKEN` | Yes* | Auto-set by `vercel env pull` for Sandbox auth |
| `VERCEL_TOKEN` | Alt* | Alternative to OIDC — a Vercel personal access token |
| `VERCEL_TEAM_ID` | Alt* | Required with `VERCEL_TOKEN` |
| `VERCEL_PROJECT_ID` | Alt* | Required with `VERCEL_TOKEN` |

\* Either `VERCEL_OIDC_TOKEN` (via `vercel env pull`) or the `VERCEL_TOKEN` + team/project IDs are required for Sandbox authentication.
