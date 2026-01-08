import { App, MarkdownView, Modal, Notice, TFile, FuzzySuggestModal } from 'obsidian';
import { WorkflowConfig, AIToolboxSettings } from '../settings';
import { createWorkflowProvider, ChatMessage, TranscriptionOptions } from '../providers';
import { generateFilenameTimestamp } from '../utils/date-utils';
import { createTranscriptionNote } from '../transcriptions/transcription-note';
import * as path from 'path';

/**
 * Modal to display the AI response from a workflow execution
 */
export class WorkflowResultModal extends Modal {
	private workflowName: string;
	private response: string;

	constructor(app: App, workflowName: string, response: string) {
		super(app);
		this.workflowName = workflowName;
		this.response = response;
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: this.workflowName });

		const responseContainer = contentEl.createDiv('workflow-response-container');
		responseContainer.createEl('pre', {
			text: this.response,
			cls: 'workflow-response-content'
		});

		// Add copy button
		const buttonContainer = contentEl.createDiv('workflow-response-buttons');
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
 * Create a new note with the workflow result.
 * Honors Obsidian's default new note location setting.
 */
async function createNoteWithResult(
	app: App,
	workflowName: string,
	promptText: string,
	response: string,
	outputFolder?: string
): Promise<void> {
	const timestamp = generateFilenameTimestamp();
	const noteTitle = `${workflowName} - ${timestamp}`;

	// Build note content with prompt and response
	const noteContent = `# ${workflowName}

## Prompt

${promptText}

## Response

${response}

---
*Generated on ${new Date().toLocaleString()}*
`;

	// Determine folder path: use workflow-specific folder if set, otherwise fall back to Obsidian's default
	let folderPath: string | undefined;
	if (outputFolder && outputFolder.trim() !== '') {
		folderPath = outputFolder.trim().replace(/\/$/, '');
	} else {
		// Get the default new note location from Obsidian's vault config
		// This method exists but is not in the public type definitions
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const vault = app.vault as any;
		const newFileFolderPath = vault.getConfig?.('newFileFolderPath') as string | undefined;
		if (newFileFolderPath && newFileFolderPath.trim() !== '') {
			folderPath = newFileFolderPath.replace(/\/$/, '');
		}
	}

	// Build the file path
	let filePath: string;
	if (folderPath) {
		// Ensure folder exists
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
 * Get the prompt text for a workflow, loading from file if needed.
 */
async function getPromptText(app: App, workflow: WorkflowConfig): Promise<string | null> {
	const sourceType = workflow.promptSourceType ?? 'inline';

	if (sourceType === 'from-file') {
		const filePath = workflow.promptFilePath;
		if (!filePath || !filePath.trim()) {
			new Notice(`Workflow "${workflow.name}" has no prompt file configured. Please select a file in settings.`);
			return null;
		}

		const file = app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) {
			new Notice(`Prompt file "${filePath}" not found in vault for workflow "${workflow.name}".`);
			return null;
		}

		try {
			return await app.vault.read(file);
		} catch (error) {
			console.error('Error reading prompt file:', error);
			new Notice(`Failed to read prompt file "${filePath}": ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	// Default: use inline prompt text
	return workflow.promptText;
}

/**
 * Execute a workflow using its configured provider and display the result.
 * Routes to the appropriate execution function based on workflow type.
 *
 * @param app - Obsidian App instance
 * @param settings - Plugin settings
 * @param workflow - The workflow configuration to execute
 */
export async function executeWorkflow(
	app: App,
	settings: AIToolboxSettings,
	workflow: WorkflowConfig
): Promise<void> {
	const workflowType = workflow.type || 'chat';

	if (workflowType === 'transcription') {
		await executeTranscriptionWorkflow(app, settings, workflow);
	} else {
		await executeChatWorkflow(app, settings, workflow);
	}
}

/**
 * Execute a chat workflow.
 */
async function executeChatWorkflow(
	app: App,
	settings: AIToolboxSettings,
	workflow: WorkflowConfig
): Promise<void> {
	// Validate workflow has a provider configured
	if (!workflow.provider) {
		new Notice(`Workflow "${workflow.name}" has no provider configured. Please configure a provider in settings.`);
		return;
	}

	// Get the prompt text (from file or inline)
	const promptText = await getPromptText(app, workflow);
	if (promptText === null) {
		return; // Error already shown to user
	}

	// Validate workflow has text
	if (!promptText.trim()) {
		new Notice(`Workflow "${workflow.name}" has no prompt text. Please add prompt text in settings.`);
		return;
	}

	// Create the provider
	const provider = createWorkflowProvider(settings, workflow);
	if (!provider) {
		new Notice(`Could not find the configured provider for workflow "${workflow.name}". Please check your settings.`);
		return;
	}

	// Validate provider supports chat
	if (!provider.supportsChat()) {
		new Notice(`The provider for workflow "${workflow.name}" does not support chat. Please select a chat-capable model.`);
		return;
	}

	try {
		new Notice(`Executing workflow: ${workflow.name}...`);

		// Build chat messages with the prompt text as a user message
		const messages: ChatMessage[] = [
			{ role: 'user', content: promptText }
		];

		// Send the chat request
		const result = await provider.sendChat(messages);

		// Handle output based on configured output type
		const outputType = workflow.outputType || 'popup';

		if (outputType === 'new-note') {
			await createNoteWithResult(app, workflow.name, promptText, result.content, workflow.outputFolder);
		} else if (outputType === 'at-cursor') {
			insertAtCursor(app, result.content);
		} else {
			// Default: show in popup modal
			const resultModal = new WorkflowResultModal(app, workflow.name, result.content);
			resultModal.open();
		}

	} catch (error) {
		console.error('Workflow execution error:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		new Notice(`Failed to execute workflow: ${errorMessage}`);
	}
}

/**
 * Modal for selecting an audio file from the vault
 */
class AudioFileSelectorModal extends FuzzySuggestModal<TFile> {
	private audioFiles: TFile[];
	private onSelect: (file: TFile) => void;

	constructor(app: App, onSelect: (file: TFile) => void) {
		super(app);
		this.onSelect = onSelect;

		// Get all audio files from the vault
		const supportedExtensions = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac', 'aac'];
		this.audioFiles = app.vault.getFiles().filter(file => {
			const ext = file.extension.toLowerCase();
			return supportedExtensions.includes(ext);
		});

		this.setPlaceholder('Select an audio file to transcribe...');
	}

	getItems(): TFile[] {
		return this.audioFiles;
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onSelect(file);
	}
}

/**
 * Execute a transcription workflow.
 */
async function executeTranscriptionWorkflow(
	app: App,
	settings: AIToolboxSettings,
	workflow: WorkflowConfig
): Promise<void> {
	// Validate workflow has a provider configured
	if (!workflow.provider) {
		new Notice(`Workflow "${workflow.name}" has no provider configured. Please configure a provider in settings.`);
		return;
	}

	// Create the provider
	const provider = createWorkflowProvider(settings, workflow);
	if (!provider) {
		new Notice(`Could not find the configured provider for workflow "${workflow.name}". Please check your settings.`);
		return;
	}

	// Validate provider supports transcription
	if (!provider.supportsTranscription()) {
		new Notice(`The provider for workflow "${workflow.name}" does not support transcription. Please select a transcription-capable model.`);
		return;
	}

	// Show file selector modal
	const modal = new AudioFileSelectorModal(app, async (audioFile: TFile) => {
		try {
			new Notice(`Transcribing ${audioFile.name}...`);

			// Get the absolute path to the audio file
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const adapter = app.vault.adapter as any;
			const audioFilePath = path.join(adapter.basePath, audioFile.path);

			// Build transcription options from workflow settings
			const transcriptionOptions: TranscriptionOptions = {
				includeTimestamps: workflow.includeTimestamps ?? true,
				language: workflow.language || undefined
			};

			// Transcribe the audio
			const transcriptionResult = await provider.transcribeAudio(audioFilePath, transcriptionOptions);

			// Handle output based on configured output type
			const outputType = workflow.outputType || 'new-note';

			if (outputType === 'new-note') {
				// Create a transcription note
				await createTranscriptionNote(
					app,
					transcriptionResult,
					audioFile.path,
					workflow.includeTimestamps ?? true,
					workflow.outputFolder || ''
				);
			} else if (outputType === 'at-cursor') {
				insertAtCursor(app, transcriptionResult.text);
			} else {
				// Show in popup modal
				const resultModal = new WorkflowResultModal(app, workflow.name, transcriptionResult.text);
				resultModal.open();
			}

		} catch (error) {
			console.error('Transcription workflow execution error:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to transcribe audio: ${errorMessage}`);
		}
	});

	modal.open();
}

