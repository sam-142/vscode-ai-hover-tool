# AI Hover Learning Tool

Hover over any keyword, identifier, or language construct in your code and get:

- **Definition** — a general explanation of what it means
- **In this code** — a specific explanation of how it's used right where you hovered

Powered by [Groq](https://groq.com), which runs open models (OpenAI gpt-oss) on custom
LPU hardware — free tier, extremely low latency, nothing runs on your machine.

Pure TypeScript + the VS Code extension API, no native dependencies, so it runs the
same way on macOS, Linux (Ubuntu, etc.), and Windows. CI builds and packages it on
`ubuntu-latest` on every push (see `.github/workflows/build.yml`).

## Setup (any OS: macOS, Ubuntu/Linux, Windows)

1. Clone the repo and install dependencies:
   ```
   git clone https://github.com/sam-142/vscode-ai-hover-tool.git
   cd vscode-ai-hover-tool
   npm install
   npm run compile
   ```
2. Get a free Groq API key at https://console.groq.com/keys (no credit card required).
3. Package and install it as a real extension:
   ```
   npx @vscode/vsce package
   code --install-extension ai-hover-tool-0.1.0.vsix
   ```
   On Ubuntu, the `code` CLI is on your `PATH` automatically after installing VS Code
   via the `.deb` package, the snap, or the official apt repo. If `code` isn't found,
   open VS Code → Extensions view → `...` menu → **Install from VSIX...** and pick the
   `.vsix` file instead.
4. Reload VS Code, open the Command Palette (`Ctrl+Shift+P` on Linux/Windows,
   `Cmd+Shift+P` on macOS) and run **AI Hover Tool: Set Groq API Key**, then paste your key.
5. Hover over any identifier in a code file.

Alternatively, for active development: open the folder in VS Code and press `F5` to
launch an Extension Development Host with live reload instead of packaging a `.vsix`.

## Commands

| Command | Description |
|---|---|
| `AI Hover Tool: Set Groq API Key` | Store your Groq key securely (VS Code Secret Storage) |
| `AI Hover Tool: Clear Groq API Key` | Remove the stored key |
| `AI Hover Tool: Toggle Enabled` | Turn hover explanations on/off |
| `AI Hover Tool: Clear Explanation Cache` | Drop cached explanations (e.g. after editing heavily) |

## Settings

- `aiHoverTool.model` — `openai/gpt-oss-20b` (default, fastest, ~1000 tok/s) or `openai/gpt-oss-120b` (slower, more accurate)
- `aiHoverTool.contextLines` — how many lines above/below the hovered word to send as context (default 25)
- `aiHoverTool.maxTokens` — response length cap (default 220, keeps tooltips snappy)
- `aiHoverTool.minWordLength` — skip very short tokens (default 2)
- `aiHoverTool.excludedLanguages` — language IDs to skip (default: plaintext, log, markdown)

## Notes

- Explanations are cached per (model, language, word, surrounding-code-hash) so re-hovering
  the same spot is instant and doesn't re-call the API.
- The API key is stored in VS Code's encrypted Secret Storage, never in settings.json.
- To package as an installable `.vsix`: `npm install -g @vscode/vsce && npm run package`.
