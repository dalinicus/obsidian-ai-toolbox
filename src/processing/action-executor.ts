import { App, TFile } from 'obsidian';
import { AIToolboxSettings, ChatAction, TranscriptionAction, WorkflowAction, TranscriptionSourceType } from '../settings';
import { createActionProvider, ChatMessage, TranscriptionOptions } from '../providers';
import {
    InputHandler,
    InputContext,
    InputResult,
    VaultFileInputHandler,
    ClipboardUrlInputHandler,
    SelectionUrlInputHandler
} from '../handlers';
import {
    createChatWorkflowTokens,
    createTranscriptionWorkflowTokens,
    gatherContextValues,
    replaceContextTokens,
    hasContextTokens
} from './workflow-chaining';
import { logInfo, logDebug, logNotice, LogCategory } from '../logging';

/**
 * Result from executing a single action
 */
export interface ActionExecutionResult {
    /** The action that was executed */
    actionId: string;
    /** The action type */
    actionType: 'chat' | 'transcription';
    /** Whether execution succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Token values produced by this action */
    tokens: Record<string, string>;
    /** Additional metadata (e.g., for transcription note title) */
    metadata?: {
        noteTitle?: string;
        inputResult?: InputResult;
    };
}

/**
 * Map of action ID to execution results
 */
export type ActionResultsMap = Map<string, ActionExecutionResult>;

/**
 * Context for action execution
 */
export interface ActionExecutionContext {
    app: App;
    settings: AIToolboxSettings;
    /** Results from previously executed actions in this workflow */
    previousResults: ActionResultsMap;
    /** Results from dependency workflows */
    dependencyResults: Map<string, ActionExecutionResult>;
    /** The workflow name (for logging) */
    workflowName: string;
}

/**
 * Replace action tokens in text with values from previous action results.
 * Tokens are in the format {{actionId.tokenName}}
 */
export function replaceActionTokens(
    text: string,
    results: ActionResultsMap
): string {
    const tokenPattern = /\{\{([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)\}\}/g;

    return text.replace(tokenPattern, (match, actionId: string, tokenName: string) => {
        const result = results.get(actionId);
        if (!result) {
            return match;
        }

        const tokenValue = result.tokens[tokenName];
        if (tokenValue === undefined) {
            return match;
        }

        return tokenValue;
    });
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
 * Get the prompt text for a chat action, loading from file if needed.
 */
async function getPromptText(app: App, action: ChatAction): Promise<string | null> {
    const sourceType = action.promptSourceType ?? 'inline';

    if (sourceType === 'from-file') {
        const filePath = action.promptFilePath;
        if (!filePath || !filePath.trim()) {
            logNotice(LogCategory.WORKFLOW, `Action "${action.name}" has no prompt file configured.`);
            return null;
        }

        const file = app.vault.getAbstractFileByPath(filePath);
        if (!file || !(file instanceof TFile)) {
            logNotice(LogCategory.WORKFLOW, `Prompt file "${filePath}" not found for action "${action.name}".`);
            return null;
        }

        try {
            return await app.vault.read(file);
        } catch (error) {
            logNotice(LogCategory.WORKFLOW, `Failed to read prompt file: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    return action.promptText;
}

/**
 * Execute a chat action and return the result.
 */
export async function executeChatAction(
    action: ChatAction,
    context: ActionExecutionContext
): Promise<ActionExecutionResult> {
    const baseResult: ActionExecutionResult = {
        actionId: action.id,
        actionType: 'chat',
        success: false,
        tokens: {}
    };

    if (!action.provider) {
        return { ...baseResult, error: 'No provider configured' };
    }

    const provider = createActionProvider(context.settings, action);
    if (!provider) {
        return { ...baseResult, error: 'Provider not found' };
    }

    if (!provider.supportsChat()) {
        return { ...baseResult, error: 'Provider does not support chat' };
    }

    let promptText = await getPromptText(context.app, action);
    if (promptText === null) {
        return { ...baseResult, error: 'Failed to load prompt text' };
    }

    // Replace tokens from previous actions
    if (context.previousResults.size > 0) {
        promptText = replaceActionTokens(promptText, context.previousResults);
    }

    // Replace tokens from dependency workflows
    if (context.dependencyResults.size > 0) {
        promptText = replaceActionTokens(promptText, context.dependencyResults);
    }

    // Replace context tokens ({{selection}}, {{clipboard}}, etc.)
    if (hasContextTokens(promptText)) {
        const contextValues = await gatherContextValues(context.app);
        promptText = replaceContextTokens(promptText, contextValues);
    }

    if (!promptText.trim()) {
        return { ...baseResult, error: 'Empty prompt text' };
    }

    try {
        logDebug(LogCategory.WORKFLOW, `Executing chat action: ${action.name}`);

        const messages: ChatMessage[] = [
            { role: 'user', content: promptText }
        ];

        const result = await provider.sendChat(messages);
        logInfo(LogCategory.WORKFLOW, `Chat action completed: ${action.name}`);

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
 * Execute a transcription action and return the result.
 */
export async function executeTranscriptionAction(
    action: TranscriptionAction,
    context: ActionExecutionContext
): Promise<ActionExecutionResult> {
    const baseResult: ActionExecutionResult = {
        actionId: action.id,
        actionType: 'transcription',
        success: false,
        tokens: {}
    };

    if (!action.provider) {
        return { ...baseResult, error: 'No provider configured' };
    }

    const provider = createActionProvider(context.settings, action);
    if (!provider) {
        return { ...baseResult, error: 'Provider not found' };
    }

    if (!provider.supportsTranscription()) {
        return { ...baseResult, error: 'Provider does not support transcription' };
    }

    const sourceType: TranscriptionSourceType = action.transcriptionContext?.sourceType ?? 'url-from-clipboard';
    const inputHandler = createInputHandler(sourceType);

    // Create a minimal workflow-like object for InputContext compatibility
    const inputContext: InputContext = {
        app: context.app,
        settings: context.settings,
        workflow: {
            id: action.id,
            name: action.name,
            actions: [],
            outputType: 'popup',
            outputFolder: ''
        }
    };

    try {
        logDebug(LogCategory.TRANSCRIPTION, `Executing transcription action: ${action.name}`);

        const inputResult = await inputHandler.getInput(inputContext);
        if (!inputResult) {
            return { ...baseResult, error: 'No input provided or cancelled' };
        }

        logNotice(LogCategory.TRANSCRIPTION, `Transcribing audio...`);

        const timestampGranularity = action.timestampGranularity ?? 'disabled';
        const transcriptionOptions: TranscriptionOptions = {
            timestampGranularity,
            language: action.language || undefined
        };

        const transcriptionResult = await provider.transcribeAudio(inputResult.audioFilePath, transcriptionOptions);
        logInfo(LogCategory.TRANSCRIPTION, `Transcription action completed: ${action.name}`);

        const tokenMetadata = {
            ...inputResult.metadata,
            sourceUrl: inputResult.sourceUrl
        };

        return {
            ...baseResult,
            success: true,
            tokens: createTranscriptionWorkflowTokens(transcriptionResult, tokenMetadata, timestampGranularity),
            metadata: {
                inputResult
            }
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { ...baseResult, error: errorMessage };
    }
}

/**
 * Execute any action type and return the result.
 */
export async function executeAction(
    action: WorkflowAction,
    context: ActionExecutionContext
): Promise<ActionExecutionResult> {
    if (action.type === 'chat') {
        return executeChatAction(action, context);
    } else {
        return executeTranscriptionAction(action, context);
    }
}

