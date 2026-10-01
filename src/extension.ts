import * as vscode from 'vscode';
import { explainKeyword } from './groqClient';

const SECRET_KEY = 'aiHoverTool.groqApiKey';
const MAX_CACHE_ENTRIES = 500;

let secretStorage: vscode.SecretStorage;
const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function hashString(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function rememberInCache(key: string, value: string): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, value);
}

function getContextWindow(document: vscode.TextDocument, line: number, contextLines: number): string {
  const startLine = Math.max(0, line - contextLines);
  const endLine = Math.min(document.lineCount - 1, line + contextLines);
  const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
  return document.getText(range);
}

class AiHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const config = vscode.workspace.getConfiguration('aiHoverTool');
    if (!config.get<boolean>('enabled', true)) {
      return undefined;
    }

    const excludedLanguages = config.get<string[]>('excludedLanguages', []);
    if (excludedLanguages.includes(document.languageId)) {
      return undefined;
    }

    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return undefined;
    }

    const word = document.getText(wordRange);
    const minLength = config.get<number>('minWordLength', 2);
    if (word.length < minLength || /^\d+$/.test(word)) {
      return undefined;
    }

    const apiKey = await secretStorage.get(SECRET_KEY);
    if (!apiKey) {
      return new vscode.Hover(
        new vscode.MarkdownString(
          '**AI Hover Tool**: no Groq API key set. Run `AI Hover Tool: Set Groq API Key` from the Command Palette (free key at https://console.groq.com/keys).'
        ),
        wordRange
      );
    }

    const contextLines = config.get<number>('contextLines', 25);
    const maxTokens = config.get<number>('maxTokens', 220);
    const model = config.get<string>('model', 'openai/gpt-oss-20b');
    const contextCode = getContextWindow(document, position.line, contextLines);

    const cacheKey = `${model}:${document.languageId}:${word}:${hashString(contextCode)}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return new vscode.Hover(new vscode.MarkdownString(cached), wordRange);
    }

    const existing = inFlight.get(cacheKey);
    const controller = new AbortController();
    token.onCancellationRequested(() => controller.abort());

    const requestPromise =
      existing ??
      explainKeyword(
        { apiKey, model, maxTokens, word, languageId: document.languageId, contextCode },
        controller.signal
      );

    if (!existing) {
      inFlight.set(cacheKey, requestPromise);
    }

    try {
      const explanation = await requestPromise;
      rememberInCache(cacheKey, explanation);
      if (token.isCancellationRequested) {
        return undefined;
      }
      const markdown = new vscode.MarkdownString(explanation);
      markdown.isTrusted = false;
      return new vscode.Hover(markdown, wordRange);
    } catch (err) {
      if (token.isCancellationRequested) {
        return undefined;
      }
      const message = err instanceof Error ? err.message : String(err);
      return new vscode.Hover(
        new vscode.MarkdownString(`**AI Hover Tool error**: ${message}`),
        wordRange
      );
    } finally {
      inFlight.delete(cacheKey);
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  secretStorage = context.secrets;

  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: 'file' }, new AiHoverProvider()),
    vscode.languages.registerHoverProvider({ scheme: 'untitled' }, new AiHoverProvider())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aiHoverTool.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your free Groq API key (from https://console.groq.com/keys)',
        password: true,
        ignoreFocusOut: true
      });
      if (key) {
        await secretStorage.store(SECRET_KEY, key.trim());
        vscode.window.showInformationMessage('AI Hover Tool: Groq API key saved.');
      }
    }),

    vscode.commands.registerCommand('aiHoverTool.clearApiKey', async () => {
      await secretStorage.delete(SECRET_KEY);
      vscode.window.showInformationMessage('AI Hover Tool: Groq API key cleared.');
    }),

    vscode.commands.registerCommand('aiHoverTool.toggleEnabled', async () => {
      const config = vscode.workspace.getConfiguration('aiHoverTool');
      const current = config.get<boolean>('enabled', true);
      await config.update('enabled', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`AI Hover Tool: ${!current ? 'enabled' : 'disabled'}.`);
    }),

    vscode.commands.registerCommand('aiHoverTool.clearCache', () => {
      cache.clear();
      vscode.window.showInformationMessage('AI Hover Tool: explanation cache cleared.');
    })
  );
}

export function deactivate(): void {
  cache.clear();
  inFlight.clear();
}
