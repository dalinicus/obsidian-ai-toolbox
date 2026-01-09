import { App, Notice, TFile } from 'obsidian';
import { WorkflowConfig, AIToolboxSettings, TranscriptionSourceType } from '../settings';
import { createWorkflowProvider, ChatMessage, TranscriptionOptions, TranscriptionResult } from '../providers';
import { videoPlatformRegistry } from './video-platforms';
import { generateFilenameTimestamp } from '../utils/date-utils';
import {
    OutputHandler,
    OutputContext,
    NewNoteOutputHandler,
    AtCursorOutputHandler,
    PopupOutputHandler,
    InputHandler,
    InputContext,
    InputResult,
    VaultFileInputHandler,
    ClipboardUrlInputHandler,
    SelectionUrlInputHandler
} from '../handlers';

/**
 * Create an output handler based on the workflow's output type.
 */
function createOutputHandler(outputType: string): OutputHandler {
	switch (outputType) {
		case 'new-note':
			return new NewNoteOutputHandler();
		case 'at-cursor':
			return new AtCursorOutputHandler();
		case 'popup':
		default:
			return new PopupOutputHandler();
	}
}

/**
 * Create an input handler based on the transcription source type.
 */
function createInputHandler(sourceType: TranscriptionSourceType): InputHandler {
	switch (sourceType) {
		case 'select-file-from-vault':
			return new VaultFileInputHandler();
		case 'url-from-clipboard':
			return new ClipboardUrlInputHandler();
		case 'url-from-selection':
			return new SelectionUrlInputHandler();
		default:
			return new VaultFileInputHandler();
	}
}

/**
 * Format a timestamp in seconds to MM:SS or HH:MM:SS format.
 */
function formatTimestamp(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}
	return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a transcription result, optionally including timestamps.
 * When timestamps are included and chunks are available, formats each segment
 * with its start time prefix.
 */
function formatTranscriptionResult(result: TranscriptionResult, includeTimestamps: boolean): string {
	if (!includeTimestamps || !result.chunks || result.chunks.length === 0) {
		return result.text;
	}

	return result.chunks
		.map(chunk => `[${formatTimestamp(chunk.timestamp[0])}] ${chunk.text}`)
		.join('\n');
}

/**
 * Generate a note title for transcription output based on input source.
 * - TikTok: "TikTok by <Author> - <Timestamp>"
 * - YouTube: "<Video Title> - <Author> - <Timestamp>"
 * - Vault file/fallback: "<Workflow Name> - <Timestamp>"
 */
function generateTranscriptionNoteTitle(inputResult: InputResult, workflowName: string): string {
	const timestamp = generateFilenameTimestamp();

	if (!inputResult.sourceUrl) {
		return `${workflowName} - ${timestamp}`;
	}

	const handler = videoPlatformRegistry.findHandlerForUrl(inputResult.sourceUrl);
	const metadata = inputResult.metadata;

	if (handler?.platformId === 'tiktok') {
		const author = metadata?.uploader || 'Unknown';
		return `TikTok by ${author} - ${timestamp}`;
	}

	if (handler?.platformId === 'youtube') {
		const title = metadata?.title || 'Video';
		const author = metadata?.uploader || 'Unknown';
		return `${title} - ${author} - ${timestamp}`;
	}

	return `${workflowName} - ${timestamp}`;
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

		// Handle output using the output handler system
		const outputType = workflow.outputType || 'popup';
		const handler = createOutputHandler(outputType);
		const context: OutputContext = {
			app,
			workflow,
			promptText
		};

		await handler.handleOutput(result.content, context);

	} catch (error) {
		console.error('Workflow execution error:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		new Notice(`Failed to execute workflow: ${errorMessage}`);
	}
}

/**
 * Execute a transcription workflow.
 * Routes to the appropriate input handler based on workflow.transcriptionContext.sourceType.
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

	// Determine source type from workflow configuration
	const sourceType: TranscriptionSourceType = workflow.transcriptionContext?.sourceType ?? 'url-from-clipboard';

	// Create appropriate input handler based on source type
	const inputHandler = createInputHandler(sourceType);
	const inputContext: InputContext = {
		app,
		settings,
		workflow
	};

	try {
		// Get input (audio file path) from the input handler
		const inputResult = await inputHandler.getInput(inputContext);

		if (!inputResult) {
			// User cancelled or operation failed (error already shown by handler)
			return;
		}

		new Notice(`Transcribing audio...`);

		// Build transcription options from workflow settings
		const transcriptionOptions: TranscriptionOptions = {
			includeTimestamps: workflow.includeTimestamps ?? true,
			language: workflow.language || undefined
		};

		// Transcribe the audio
		const transcriptionResult = await provider.transcribeAudio(inputResult.audioFilePath, transcriptionOptions);

		// Format the transcription with timestamps if enabled
		const formattedText = formatTranscriptionResult(
			transcriptionResult,
			workflow.includeTimestamps ?? true
		);

		// Generate note title based on source platform
		const noteTitle = generateTranscriptionNoteTitle(inputResult, workflow.name);

		// Handle output using the output handler system
		const outputType = workflow.outputType || 'new-note';
		const handler = createOutputHandler(outputType);
		const context: OutputContext = {
			app,
			workflow,
			noteTitle
		};

		await handler.handleOutput(formattedText, context);

	} catch (error) {
		console.error('Transcription workflow execution error:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		new Notice(`Failed to transcribe audio: ${errorMessage}`);
	}
}
