import { App, TFile } from 'obsidian';
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
import {
    WorkflowExecutionResult,
    WorkflowResultsMap,
    detectCircularDependency,
    hasWorkflowDependencies,
    replaceWorkflowTokens,
    createChatWorkflowTokens,
    createTranscriptionWorkflowTokens,
    getDependencyWorkflowIds,
    gatherContextValues,
    replaceContextTokens,
    hasContextTokens,
    formatTranscriptionWithTimestamps
} from './workflow-chaining';
import { logInfo, logDebug, logWarn, logNotice, LogCategory } from '../logging';

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
			logNotice(LogCategory.WORKFLOW, `Workflow "${workflow.name}" has no prompt file configured. Please select a file in settings.`);
			return null;
		}

		const file = app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) {
			logNotice(LogCategory.WORKFLOW, `Prompt file "${filePath}" not found in vault for workflow "${workflow.name}".`);
			return null;
		}

		try {
			return await app.vault.read(file);
		} catch (error) {
			logNotice(LogCategory.WORKFLOW, `Failed to read prompt file "${filePath}": ${error instanceof Error ? error.message : String(error)}`, error);
			return null;
		}
	}

	// Default: use inline prompt text
	return workflow.promptText;
}

/**
 * Recursively execute workflow dependencies and collect their results.
 * Handles circular dependency detection and proper execution order.
 */
async function executeDependencies(
	app: App,
	settings: AIToolboxSettings,
	workflow: WorkflowConfig,
	results: WorkflowResultsMap,
	executionStack: Set<string>
): Promise<boolean> {
	const dependencyIds = getDependencyWorkflowIds(workflow);

	for (const depId of dependencyIds) {
		// Skip if already executed
		if (results.has(depId)) {
			continue;
		}

		// Check for circular dependency (already in execution stack)
		if (executionStack.has(depId)) {
			const depWorkflow = settings.workflows.find(w => w.id === depId);
			logNotice(LogCategory.WORKFLOW, `Circular dependency detected: "${depWorkflow?.name ?? depId}" is already being executed.`);
			return false;
		}

		const depWorkflow = settings.workflows.find(w => w.id === depId);
		if (!depWorkflow) {
			logNotice(LogCategory.WORKFLOW, `Dependency workflow not found: ${depId}`);
			return false;
		}

		// Add to execution stack
		executionStack.add(depId);

		// Recursively execute this dependency's dependencies first
		if (hasWorkflowDependencies(depWorkflow)) {
			const depSuccess = await executeDependencies(app, settings, depWorkflow, results, executionStack);
			if (!depSuccess) {
				return false;
			}
		}

		// Execute the dependency workflow
		logNotice(LogCategory.WORKFLOW, `Executing dependency: ${depWorkflow.name}...`);
		const result = await executeWorkflowInternal(app, settings, depWorkflow, results);

		if (!result.success) {
			logNotice(LogCategory.WORKFLOW, `Dependency workflow "${depWorkflow.name}" failed: ${result.error}`);
			return false;
		}

		results.set(depId, result);
		executionStack.delete(depId);
	}

	return true;
}

/**
 * Execute a workflow using its configured provider and display the result.
 * Routes to the appropriate execution function based on workflow type.
 * Handles workflow dependency chains by executing dependencies first.
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
	logInfo(LogCategory.WORKFLOW, `Starting workflow: ${workflow.name}`, { type: workflow.type, id: workflow.id });

	// Check for circular dependencies before starting
	if (hasWorkflowDependencies(workflow)) {
		const cycle = detectCircularDependency(workflow, settings);
		if (cycle.length > 0) {
			logNotice(LogCategory.WORKFLOW, `Circular dependency detected: ${cycle.join(' → ')}`);
			return;
		}

		// Execute all dependencies first
		const results: WorkflowResultsMap = new Map();
		const executionStack = new Set<string>();
		executionStack.add(workflow.id);

		const dependenciesSuccess = await executeDependencies(
			app, settings, workflow, results, executionStack
		);

		if (!dependenciesSuccess) {
			return;
		}

		// Execute main workflow with dependency results
		const workflowType = workflow.type || 'chat';
		if (workflowType === 'transcription') {
			await executeTranscriptionWorkflow(app, settings, workflow, results);
		} else {
			await executeChatWorkflow(app, settings, workflow, results);
		}
	} else {
		// No dependencies - execute directly
		const workflowType = workflow.type || 'chat';
		if (workflowType === 'transcription') {
			await executeTranscriptionWorkflow(app, settings, workflow);
		} else {
			await executeChatWorkflow(app, settings, workflow);
		}
	}
}

/**
 * Internal workflow execution that returns a result for chaining.
 * Used when executing workflows as dependencies.
 */
async function executeWorkflowInternal(
	app: App,
	settings: AIToolboxSettings,
	workflow: WorkflowConfig,
	dependencyResults: WorkflowResultsMap
): Promise<WorkflowExecutionResult> {
	const workflowType = workflow.type || 'chat';

	if (workflowType === 'transcription') {
		return await executeTranscriptionWorkflowInternal(app, settings, workflow, dependencyResults);
	} else {
		return await executeChatWorkflowInternal(app, settings, workflow, dependencyResults);
	}
}

/**
 * Execute a chat workflow (displays output to user).
 */
async function executeChatWorkflow(
	app: App,
	settings: AIToolboxSettings,
	workflow: WorkflowConfig,
	dependencyResults?: WorkflowResultsMap
): Promise<void> {
	// Validate workflow has a provider configured
	if (!workflow.provider) {
		logNotice(LogCategory.WORKFLOW, `Workflow "${workflow.name}" has no provider configured. Please configure a provider in settings.`);
		return;
	}

	// Get the prompt text (from file or inline)
	let promptText = await getPromptText(app, workflow);
	if (promptText === null) {
		return; // Error already shown to user
	}

	// Replace workflow context tokens if we have dependency results
	if (dependencyResults && dependencyResults.size > 0) {
		promptText = replaceWorkflowTokens(promptText, dependencyResults);
	}

	// Replace context tokens ({{selection}}, {{clipboard}}, etc.) with actual values
	if (hasContextTokens(promptText)) {
		const contextValues = await gatherContextValues(app);
		promptText = replaceContextTokens(promptText, contextValues);
	}

	// Validate workflow has text
	if (!promptText.trim()) {
		logNotice(LogCategory.WORKFLOW, `Workflow "${workflow.name}" has no prompt text. Please add prompt text in settings.`);
		return;
	}

	// Create the provider
	const provider = createWorkflowProvider(settings, workflow);
	if (!provider) {
		logNotice(LogCategory.WORKFLOW, `Could not find the configured provider for workflow "${workflow.name}". Please check your settings.`);
		return;
	}

	// Validate provider supports chat
	if (!provider.supportsChat()) {
		logNotice(LogCategory.WORKFLOW, `The provider for workflow "${workflow.name}" does not support chat. Please select a chat-capable model.`);
		return;
	}

	try {
		logNotice(LogCategory.WORKFLOW, `Executing workflow: ${workflow.name}...`);
		logDebug(LogCategory.WORKFLOW, `Sending chat request to provider`);

		const messages: ChatMessage[] = [
			{ role: 'user', content: promptText }
		];

		const result = await provider.sendChat(messages);
		logInfo(LogCategory.WORKFLOW, `Chat workflow completed: ${workflow.name}`);

		const outputType = workflow.outputType || 'popup';
		const handler = createOutputHandler(outputType);
		const context: OutputContext = {
			app,
			workflow,
			promptText
		};

		await handler.handleOutput(result.content, context);

	} catch (error) {
		logNotice(LogCategory.WORKFLOW, `Workflow execution error: ${workflow.name}`, error);
	}
}

/**
 * Internal chat workflow execution that returns a result for chaining.
 */
async function executeChatWorkflowInternal(
	app: App,
	settings: AIToolboxSettings,
	workflow: WorkflowConfig,
	dependencyResults: WorkflowResultsMap
): Promise<WorkflowExecutionResult> {
	const baseResult: WorkflowExecutionResult = {
		workflowId: workflow.id,
		workflowType: 'chat',
		success: false,
		tokens: {}
	};

	if (!workflow.provider) {
		return { ...baseResult, error: 'No provider configured' };
	}

	let promptText = await getPromptText(app, workflow);
	if (promptText === null) {
		return { ...baseResult, error: 'Failed to load prompt text' };
	}

	// Replace workflow context tokens
	if (dependencyResults.size > 0) {
		promptText = replaceWorkflowTokens(promptText, dependencyResults);
	}

	// Replace context tokens ({{selection}}, {{clipboard}}, etc.) with actual values
	if (hasContextTokens(promptText)) {
		const contextValues = await gatherContextValues(app);
		promptText = replaceContextTokens(promptText, contextValues);
	}

	if (!promptText.trim()) {
		return { ...baseResult, error: 'Empty prompt text' };
	}

	const provider = createWorkflowProvider(settings, workflow);
	if (!provider) {
		return { ...baseResult, error: 'Provider not found' };
	}

	if (!provider.supportsChat()) {
		return { ...baseResult, error: 'Provider does not support chat' };
	}

	try {
		const messages: ChatMessage[] = [
			{ role: 'user', content: promptText }
		];

		const result = await provider.sendChat(messages);

		return {
			...baseResult,
			success: true,
			tokens: createChatWorkflowTokens(promptText, result.content)
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { ...baseResult, error: errorMessage };
	}
}

/**
 * Execute a transcription workflow (displays output to user).
 * Routes to the appropriate input handler based on workflow.transcriptionContext.sourceType.
 */
async function executeTranscriptionWorkflow(
	app: App,
	settings: AIToolboxSettings,
	workflow: WorkflowConfig,
	_dependencyResults?: WorkflowResultsMap
): Promise<void> {
	if (!workflow.provider) {
		logNotice(LogCategory.TRANSCRIPTION, `Workflow "${workflow.name}" has no provider configured. Please configure a provider in settings.`);
		return;
	}

	const provider = createWorkflowProvider(settings, workflow);
	if (!provider) {
		logNotice(LogCategory.TRANSCRIPTION, `Could not find the configured provider for workflow "${workflow.name}". Please check your settings.`);
		return;
	}

	if (!provider.supportsTranscription()) {
		logNotice(LogCategory.TRANSCRIPTION, `The provider for workflow "${workflow.name}" does not support transcription. Please select a transcription-capable model.`);
		return;
	}

	const sourceType: TranscriptionSourceType = workflow.transcriptionContext?.sourceType ?? 'url-from-clipboard';
	const inputHandler = createInputHandler(sourceType);
	const inputContext: InputContext = { app, settings, workflow };

	try {
		const inputResult = await inputHandler.getInput(inputContext);
		if (!inputResult) {
			return;
		}

		logNotice(LogCategory.TRANSCRIPTION, `Transcribing audio...`);
		logDebug(LogCategory.TRANSCRIPTION, `Transcribing audio file: ${inputResult.audioFilePath}`);

		const transcriptionOptions: TranscriptionOptions = {
			timestampGranularity: workflow.timestampGranularity ?? 'disabled',
			language: workflow.language || undefined
		};

		const transcriptionResult = await provider.transcribeAudio(inputResult.audioFilePath, transcriptionOptions);
		logInfo(LogCategory.TRANSCRIPTION, `Transcription completed: ${workflow.name}`);

		// Use timestamped version for display output if available, otherwise plain text
		const formattedText = transcriptionResult.chunks.length > 0
			? formatTranscriptionWithTimestamps(transcriptionResult.chunks)
			: transcriptionResult.text;
		const noteTitle = generateTranscriptionNoteTitle(inputResult, workflow.name);

		const outputType = workflow.outputType || 'new-note';
		const handler = createOutputHandler(outputType);
		const context: OutputContext = { app, workflow, noteTitle };

		await handler.handleOutput(formattedText, context);

	} catch (error) {
		logNotice(LogCategory.TRANSCRIPTION, `Transcription workflow error: ${workflow.name}`, error);
	}
}

/**
 * Internal transcription workflow execution that returns a result for chaining.
 */
async function executeTranscriptionWorkflowInternal(
	app: App,
	settings: AIToolboxSettings,
	workflow: WorkflowConfig,
	_dependencyResults: WorkflowResultsMap
): Promise<WorkflowExecutionResult> {
	const baseResult: WorkflowExecutionResult = {
		workflowId: workflow.id,
		workflowType: 'transcription',
		success: false,
		tokens: {}
	};

	if (!workflow.provider) {
		return { ...baseResult, error: 'No provider configured' };
	}

	const provider = createWorkflowProvider(settings, workflow);
	if (!provider) {
		return { ...baseResult, error: 'Provider not found' };
	}

	if (!provider.supportsTranscription()) {
		return { ...baseResult, error: 'Provider does not support transcription' };
	}

	const sourceType: TranscriptionSourceType = workflow.transcriptionContext?.sourceType ?? 'url-from-clipboard';
	const inputHandler = createInputHandler(sourceType);
	const inputContext: InputContext = { app, settings, workflow };

	try {
		const inputResult = await inputHandler.getInput(inputContext);
		if (!inputResult) {
			return { ...baseResult, error: 'No input provided or cancelled' };
		}

		const timestampGranularity = workflow.timestampGranularity ?? 'disabled';
		const transcriptionOptions: TranscriptionOptions = {
			timestampGranularity,
			language: workflow.language || undefined
		};

		const transcriptionResult = await provider.transcribeAudio(inputResult.audioFilePath, transcriptionOptions);

		// Combine metadata with sourceUrl for token creation
		const tokenMetadata = {
			...inputResult.metadata,
			sourceUrl: inputResult.sourceUrl
		};

		return {
			...baseResult,
			success: true,
			tokens: createTranscriptionWorkflowTokens(transcriptionResult, tokenMetadata, timestampGranularity)
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { ...baseResult, error: errorMessage };
	}
}
