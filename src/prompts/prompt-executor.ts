import { App, MarkdownView, Modal, Notice, TFile } from 'obsidian';
import { PromptConfig, AIToolboxSettings } from '../settings';
import { createPromptProvider, ChatMessage } from '../providers';
import { generateFilenameTimestamp } from '../utils/date-utils';

/**
 * Modal to display the AI response from a prompt execution
 */
export class PromptResultModal extends Modal {
	private promptName: string;
	private response: string;

	constructor(app: App, promptName: string, response: string) {
		super(app);
		this.promptName = promptName;
		this.response = response;
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: this.promptName });

		const responseContainer = contentEl.createDiv('prompt-response-container');
		responseContainer.createEl('pre', {
			text: this.response,
			cls: 'prompt-response-content'
		});

		// Add copy button
		const buttonContainer = contentEl.createDiv('prompt-response-buttons');
		const copyButton = buttonContainer.createEl('button', { text: 'Copy to clipboard' });
		copyButton.addEventListener('click', async () => {
			await navigator.clipboard.writeText(this.response);
			new Notice('Response copied to clipboard');
		});

		const closeButton = buttonContainer.createEl('button', { text: 'Close' });
		closeButton.addEventListener('click', () => this.close());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Insert text at the current cursor position in the active editor.
 */
function insertAtCursor(app: App, text: string): void {
	const activeView = app.workspace.getActiveViewOfType(MarkdownView);
	if (!activeView) {
		new Notice('No active editor. Please open a note first.');
		return;
	}

	const editor = activeView.editor;
	const cursor = editor.getCursor();
	editor.replaceRange(text, cursor);

	// Move cursor to end of inserted text
	const lines = text.split('\n');
	const lastLine = lines[lines.length - 1] ?? '';
	const newLine = cursor.line + lines.length - 1;
	const newCh = lines.length === 1 ? cursor.ch + lastLine.length : lastLine.length;
	editor.setCursor({ line: newLine, ch: newCh });

	new Notice('Response inserted at cursor');
}

/**
 * Create a new note with the prompt result.
 * Honors Obsidian's default new note location setting.
 */
async function createNoteWithResult(
	app: App,
	promptName: string,
	promptText: string,
	response: string
): Promise<void> {
	const timestamp = generateFilenameTimestamp();
	const noteTitle = `${promptName} - ${timestamp}`;

	// Build note content with prompt and response
	const noteContent = `# ${promptName}

## Prompt

${promptText}

## Response

${response}

---
*Generated on ${new Date().toLocaleString()}*
`;

	// Get the default new note location from Obsidian's vault config
	// This method exists but is not in the public type definitions
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const vault = app.vault as any;
	const newFileFolderPath = vault.getConfig?.('newFileFolderPath') as string | undefined;

	// Build the file path
	let filePath: string;
	if (newFileFolderPath && newFileFolderPath.trim() !== '') {
		// Ensure folder exists
		const folderPath = newFileFolderPath.replace(/\/$/, '');
		const folder = app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await app.vault.createFolder(folderPath);
		}
		filePath = `${folderPath}/${noteTitle}.md`;
	} else {
		filePath = `${noteTitle}.md`;
	}

	// Handle filename conflicts by appending a number
	let finalPath = filePath;
	let counter = 1;
	while (app.vault.getAbstractFileByPath(finalPath)) {
		const basePath = filePath.replace('.md', '');
		finalPath = `${basePath} (${counter}).md`;
		counter++;
	}

	// Create the note
	const file = await app.vault.create(finalPath, noteContent);

	// Open the newly created note
	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(file as TFile);

	new Notice(`Created note: ${file.name}`);
}

/**
 * Execute a prompt using its configured provider and display the result.
 *
 * @param app - Obsidian App instance
 * @param settings - Plugin settings
 * @param prompt - The prompt configuration to execute
 */
export async function executePrompt(
	app: App,
	settings: AIToolboxSettings,
	prompt: PromptConfig
): Promise<void> {
	// Validate prompt has a provider configured
	if (!prompt.provider) {
		new Notice(`Prompt "${prompt.name}" has no provider configured. Please configure a provider in settings.`);
		return;
	}

	// Validate prompt has text
	if (!prompt.promptText.trim()) {
		new Notice(`Prompt "${prompt.name}" has no prompt text. Please add prompt text in settings.`);
		return;
	}

	// Create the provider
	const provider = createPromptProvider(settings, prompt);
	if (!provider) {
		new Notice(`Could not find the configured provider for prompt "${prompt.name}". Please check your settings.`);
		return;
	}

	// Validate provider supports chat
	if (!provider.supportsChat()) {
		new Notice(`The provider for prompt "${prompt.name}" does not support chat. Please select a chat-capable model.`);
		return;
	}

	try {
		new Notice(`Executing prompt: ${prompt.name}...`);

		// Build chat messages with the prompt text as a user message
		const messages: ChatMessage[] = [
			{ role: 'user', content: prompt.promptText }
		];

		// Send the chat request
		const result = await provider.sendChat(messages);

		// Handle output based on configured output type
		const outputType = prompt.outputType || 'popup';

		if (outputType === 'new-note') {
			await createNoteWithResult(app, prompt.name, prompt.promptText, result.content);
		} else if (outputType === 'at-cursor') {
			insertAtCursor(app, result.content);
		} else {
			// Default: show in popup modal
			const resultModal = new PromptResultModal(app, prompt.name, result.content);
			resultModal.open();
		}

	} catch (error) {
		console.error('Prompt execution error:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		new Notice(`Failed to execute prompt: ${errorMessage}`);
	}
}

