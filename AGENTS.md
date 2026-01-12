# AI Toolbox Obsidian plugin

## Agent instructions

- Run builds (`npm run build`) to verify your changes compile correctly.
- Only run linting (`eslint ./src/`) when preparing for a pull request.

## Project overview

- **Plugin**: AI Toolbox - A personal collection of AI tools to enhance Obsidian workflows.
- **Core features**: AI-powered transcription and configurable chat workflows with multiple AI providers.
- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `src/main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.
- Desktop only (`isDesktopOnly: true`) due to external tool dependencies (yt-dlp, ffmpeg).

## Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: npm** (`package.json` defines npm scripts and dependencies).
- **Bundler: esbuild** (`esbuild.config.mjs` and build scripts depend on it).
- Types: `obsidian` type definitions.

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## Linting

- To use eslint install eslint from terminal: `npm install -g eslint`
- To use eslint to analyze this project use this command: `eslint main.ts`
- eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder: `eslint ./src/`

## File & folder conventions

- **Organize code into multiple files**: Split functionality across separate modules rather than putting everything in `main.ts`.
- Source lives in `src/`. Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands).
- **Example file structure**:
  ```
  src/
    main.ts              # Plugin entry point, lifecycle management
    settings/            # Settings interfaces, types, and UI
      index.ts           # Settings tab (Providers, Workflows, Settings tabs)
      types.ts           # All type definitions and defaults
      providers.ts       # Provider settings UI
      workflows.ts       # Workflow settings UI
      additional-settings.ts  # Additional settings UI
    providers/           # AI model provider implementations
      index.ts           # Re-exports
      types.ts           # Provider interfaces (ModelProvider, etc.)
      provider-factory.ts    # Factory for creating providers
      base-provider.ts       # Base provider class
      openai-provider.ts     # OpenAI implementation
      azure-openai-provider.ts  # Azure OpenAI implementation
    handlers/            # Input and output handlers
      input/             # Input handlers for acquiring media
      output/            # Output handlers for presenting results
      context/           # Context handling utilities
    processing/          # Audio/video processing and workflow execution
      workflow-executor.ts   # Main workflow execution logic
      audio-processor.ts     # Audio file processing
      video-processor.ts     # Video extraction (yt-dlp)
      workflow-chaining.ts   # Workflow chaining logic
    components/          # UI components
      collapsible-section.ts
      workflow-suggester.ts
      workflow-type-modal.ts
    tokens/              # Token/template processing
    utils/               # Utility functions
  ```
- **Do not commit build artifacts**: Never commit `node_modules/`, `main.js`, or other generated files to version control.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Generated output should be placed at the plugin root or `dist/` depending on your build setup. Release artifacts must end up at the top level of the plugin folder in the vault (`main.js`, `manifest.json`, `styles.css`).

## Manifest rules (`manifest.json`)

- Must include (non-exhaustive):  
  - `id` (plugin ID; for local dev it should match the folder name)  
  - `name`  
  - `version` (Semantic Versioning `x.y.z`)  
  - `minAppVersion`  
  - `description`  
  - `isDesktopOnly` (boolean)  
  - Optional: `author`, `authorUrl`, `fundingUrl` (string or map)
- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Canonical requirements are coded here: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Testing

- Manual install for testing: copy `main.js`, `manifest.json`, `styles.css` (if any) to:
  ```
  <Vault>/.obsidian/plugins/<plugin-id>/
  ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Commands & settings

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## Versioning & releases

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map plugin version → minimum app version.
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`. Do not use a leading `v`.
- Attach `manifest.json`, `main.js`, and `styles.css` (if present) to the release as individual assets.
- After the initial release, follow the process to add/update your plugin in the community catalog as required.

### Release preparation checklist

Before creating a GitHub release, follow these steps to update version files:

#### 1. Update manifest.json
- Bump the `version` field in `manifest.json` following Semantic Versioning (x.y.z format)
- Ensure the `minAppVersion` is accurate for any new Obsidian APIs used

#### 2. Update versions.json
The `versions.json` file maps plugin versions to minimum Obsidian app versions. Update it based on the release type:

**For patch releases (x.y.Z):**
- Add the new version entry: `"x.y.z": "minimum-app-version"`
- Keep all existing entries unchanged

**For minor releases (x.Y.0):**
- Add the new version entry: `"x.y.0": "minimum-app-version"`
- For the previous minor version (x.Y-1.*), keep only the latest patch version
- Remove all other patch versions for that minor version
- Example: If releasing 1.2.0, keep only 1.1.3 (remove 1.1.0, 1.1.1, 1.1.2)

**For major releases (X.0.0):**
- Add the new version entry: `"x.0.0": "minimum-app-version"`
- For the previous major version (X-1.*.*), keep the latest two minor versions, each with their latest patch version
- Remove all other minor and patch versions for that major version
- Example: If releasing 2.0.0, keep only 1.2.3 and 1.3.2 (remove 1.0.0, 1.1.0, 1.2.1, 1.2.2, 1.3.0, 1.3.1, etc.)

#### 3. Run linting and fix issues
- Run `npx eslint ./src/` to check for code quality issues
- **Fix all errors and warnings** before creating the release
- Common issues to watch for:
  - Unused imports (remove them)
  - Floating promises (add `await` or `void` operator)
  - Sentence case violations in UI text (use lowercase after first word)
  - Unnecessary type assertions (remove redundant `as` casts)
  - Misused promises in callbacks (use `void` for fire-and-forget async calls)
  - Console statements (only `console.warn`, `console.error`, and `console.debug` are allowed)

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## UX & copy guidelines (for UI text, commands, settings)

- Prefer sentence case for headings, buttons, and titles.
- Use clear, action-oriented imperatives in step-by-step copy.
- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.

## Coding conventions

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload, addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage constraints.

## Agent do/don't

**Do**
- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.
- When refreshing collapsible settings sections, preserve the expand state by setting `callbacks.setExpandState({ workflowId: workflow.id })` before calling `callbacks.refresh()` if the section is currently expanded.
- When editing action settings that trigger a UI refresh, use `preserveActionExpandState()` callback to maintain expanded state.

**Don't**
- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.

## Common tasks

### Organize code across multiple files

**main.ts** (minimal, lifecycle only):
```ts
import { Plugin } from "obsidian";
import { MySettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";

export default class MyPlugin extends Plugin {
  settings: MySettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    registerCommands(this);
  }
}
```

**settings.ts**:
```ts
export interface MySettings {
  enabled: boolean;
  apiKey: string;
}

export const DEFAULT_SETTINGS: MySettings = {
  enabled: true,
  apiKey: "",
};
```

**commands/index.ts**:
```ts
import { Plugin } from "obsidian";
import { doSomething } from "./my-command";

export function registerCommands(plugin: Plugin) {
  plugin.addCommand({
    id: "do-something",
    name: "Do something",
    callback: () => doSomething(plugin),
  });
}
```

### Add a command

```ts
this.addCommand({
  id: "your-command-id",
  name: "Do the thing",
  callback: () => this.doTheThing(),
});
```

### Persist settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  await this.saveData(this.settings);
}
```

### Register listeners safely

```ts
this.registerEvent(this.app.workspace.on("file-open", f => { /* ... */ }));
this.registerDomEvent(window, "resize", () => { /* ... */ });
this.registerInterval(window.setInterval(() => { /* ... */ }, 1000));
```

## Action-based workflow system

Workflows are containers for sequential actions. Each workflow can contain multiple actions that execute in order, with later actions able to reference outputs from earlier actions using tokens.

### Workflow structure

```ts
interface WorkflowConfig {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  actions: WorkflowAction[];     // Sequential list of actions
  outputType: WorkflowOutputType; // 'popup' | 'new-note' | 'at-cursor'
  outputFolder: string;          // Folder for new-note output
}
```

### Action types

There are two action types: **chat** and **transcription**.

#### Chat action

Sends a prompt to an AI model and receives a response.

```ts
interface ChatAction extends BaseAction {
  type: 'chat';
  promptText: string;           // The prompt text (when inline)
  promptSourceType: PromptSourceType; // 'inline' | 'from-file'
  promptFilePath: string;       // Path to prompt file (when from-file)
  contexts?: ChatContextConfig[]; // Context sources (selection, clipboard, etc.)
}
```

**Configuration options:**
- **Provider**: Select which AI provider and model to use
- **Prompt source**: Inline text or load from a file in the vault
- **Prompt text**: The prompt template with token placeholders

#### Transcription action

Transcribes audio/video content using a speech-to-text model.

```ts
interface TranscriptionAction extends BaseAction {
  type: 'transcription';
  transcriptionContext?: {
    mediaType: 'video' | 'audio';
    sourceUrlToken?: string;    // Token containing the URL (e.g., 'workflow.clipboard')
  };
  language?: string;            // ISO language code (e.g., 'en', 'es')
  timestampGranularity?: 'disabled' | 'segment' | 'word';
}
```

**Configuration options:**
- **Provider**: Select which AI provider and model to use (must support transcription)
- **Media type**: Video or audio
- **Source URL**: Token containing the media URL (default: `workflow.clipboard`)
- **Language**: Optional language hint for better accuracy
- **Timestamp granularity**: Disabled (default), segment-level, or word-level

### Token system

Actions can reference values from workflow context and previous action outputs using `{{tokenName}}` syntax.

#### Workflow context tokens (always available)

| Token | Description |
|-------|-------------|
| `{{workflow.selection}}` | Currently selected text in the editor |
| `{{workflow.clipboard}}` | Contents of the system clipboard |
| `{{workflow.file.content}}` | Full contents of the active file |
| `{{workflow.file.path}}` | Path of the active file |

#### Chat action output tokens

| Token | Description |
|-------|-------------|
| `{{actionId.prompt}}` | The original prompt text |
| `{{actionId.response}}` | The AI response text |

#### Transcription action output tokens

| Token | Description |
|-------|-------------|
| `{{actionId.title}}` | Video title |
| `{{actionId.author}}` | Video uploader/author |
| `{{actionId.sourceUrl}}` | Original video URL |
| `{{actionId.description}}` | Video description |
| `{{actionId.tags}}` | Video tags (comma-separated) |
| `{{actionId.transcription}}` | Plain transcription text |
| `{{actionId.transcriptionWithTimestamps}}` | Transcription with `[MM:SS]` prefixes (only when timestamps enabled) |

### Token replacement example

A workflow with two actions:
1. **Transcription action** (id: `abc123`) - transcribes a video from clipboard URL
2. **Chat action** - summarizes the transcription

The chat action's prompt can reference the transcription output:

```
Summarize the following video transcript:

Title: {{abc123.title}}
Author: {{abc123.author}}

Transcript:
{{abc123.transcription}}
```

### Workflow execution flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌────────────────┐
│ Gather workflow │ ──▶ │ Execute Action 1│ ──▶ │ Execute Action 2│ ──▶ │ Output Handler │
│ context         │     │ (store tokens)  │     │ (use prev tokens)│     │ (final result) │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └────────────────┘
```

### Settings UI expand state preservation

When editing action settings that trigger a UI refresh (e.g., changing prompt source type), preserve the action's expanded state:

```ts
// In action-specific settings functions, use preserveActionExpandState callback
.onChange(async (value) => {
  action.someProperty = value;
  await plugin.saveSettings();
  preserveActionExpandState();  // Sets both workflowId and actionId
  callbacks.refresh();
});
```

The `ExpandOnNextRenderState` interface tracks which items should be expanded:

```ts
interface ExpandOnNextRenderState {
  providerId?: string;
  modelId?: string;
  workflowId?: string;
  actionId?: string;  // Added for action expand state
  availableTokensExpanded?: boolean;
}
```

### Creating new actions (avoiding shared references)

When creating new actions, always create fresh instances of nested objects and arrays:

```ts
// Correct: Create new array/object instances
const newWorkflow: WorkflowConfig = {
  id: generateId(),
  ...DEFAULT_WORKFLOW_CONFIG,
  actions: []  // New array, not shared reference
};

const newChatAction = {
  ...DEFAULT_CHAT_ACTION,
  id: generateId(),
  contexts: []  // New array
};

const newTranscriptionAction = {
  ...DEFAULT_TRANSCRIPTION_ACTION,
  id: generateId(),
  transcriptionContext: { mediaType: 'video', sourceUrlToken: 'workflow.clipboard' }  // New object
};
```

## Handler architecture

The plugin uses a handler-based architecture to separate concerns for workflow execution:

### Input handlers (`src/handlers/input/`)

Input handlers acquire media for transcription actions. Each handler implements the `InputHandler` interface:

```ts
interface InputHandler {
  getInput(context: InputContext): Promise<InputResult | null>;
}
```

**Available input handlers:**
- `VaultFileInputHandler` - Prompts user to select an audio file from the vault
- `ClipboardUrlInputHandler` - Extracts audio from a video URL in the clipboard (uses yt-dlp)
- `SelectionUrlInputHandler` - Extracts audio from a video URL in the current text selection
- `TokenUrlInputHandler` - Extracts audio from a URL resolved from a token value

**InputResult structure:**
```ts
interface InputResult {
  audioFilePath: string;      // Absolute path to the audio file
  sourceUrl?: string;         // Source URL if extracted from video
  metadata?: VideoMetadata;   // Title, uploader, description, tags
}
```

### Output handlers (`src/handlers/output/`)

Output handlers present workflow results to the user. Each handler implements the `OutputHandler` interface:

```ts
interface OutputHandler {
  handleOutput(responseText: string, context: OutputContext): Promise<void>;
}
```

**Available output handlers:**
- `PopupOutputHandler` - Displays result in a modal popup
- `NewNoteOutputHandler` - Creates a new note with the result
- `AtCursorOutputHandler` - Inserts result at the current cursor position

### Naming conventions

- Input handler classes end with `InputHandler` (e.g., `VaultFileInputHandler`)
- Output handler classes end with `OutputHandler` (e.g., `PopupOutputHandler`)
- Handler files use kebab-case matching the class name (e.g., `vault-file-input-handler.ts`)

### Extending the handler system

**To add a new input handler:**
1. Create a new file in `src/handlers/input/` (e.g., `my-custom-input-handler.ts`)
2. Implement the `InputHandler` interface
3. Export from `src/handlers/input/index.ts` and `src/handlers/index.ts`

**To add a new output handler:**
1. Create a new file in `src/handlers/output/` (e.g., `my-custom-output-handler.ts`)
2. Implement the `OutputHandler` interface
3. Export from `src/handlers/output/index.ts` and `src/handlers/index.ts`
4. Add the new output type to `WorkflowOutputType` in `src/settings/types.ts`
5. Update `createOutputHandler()` in `src/processing/workflow-executor.ts`

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`. 
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
