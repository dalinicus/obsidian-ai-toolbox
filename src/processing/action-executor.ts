import { App, TFile, requestUrl } from 'obsidian';
import { AIToolboxSettings, ChatAction, TranscriptionAction, HttpRequestAction, WorkflowAction } from '../settings';
import { createActionProvider, ChatMessage, TranscriptionOptions } from '../providers';
import {
    InputContext,
    InputResult,
    TokenUrlInputHandler
} from '../handlers';
import {
    createChatWorkflowTokens,
    createTranscriptionWorkflowTokens,
    createHttpRequestWorkflowTokens,
    ContextTokenValues,
    replaceWorkflowContextTokens
} from './workflow-chaining';
import { logInfo, logDebug, logNotice, LogCategory } from '../logging';

/**
 * Result from executing a single action
 */
export interface ActionExecutionResult {
    /** The action that was executed */
    actionId: string;
    /** The action type */
    actionType: 'chat' | 'transcription' | 'http-request';
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
    /** Workflow-level context values (clipboard, selection, etc.) gathered at workflow start */
    workflowContext: ContextTokenValues;
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
 * Resolve a token value from the execution context.
 * Tokens can reference workflow context (e.g., 'workflow.clipboard') or
 * previous action results (e.g., 'chat1.response').
 */
function resolveTokenValue(
    tokenName: string,
    context: ActionExecutionContext
): string | undefined {
    // Check if it's a workflow context token
    if (tokenName.startsWith('workflow.')) {
        const contextKey = tokenName.substring('workflow.'.length);
        switch (contextKey) {
            case 'selection':
                return context.workflowContext.selection;
            case 'clipboard':
                return context.workflowContext.clipboard;
            case 'file.content':
                return context.workflowContext.fileContent;
            case 'file.path':
                return context.workflowContext.filePath;
            default:
                return undefined;
        }
    }

    // Check if it's a previous action token (e.g., 'chat1.response')
    const dotIndex = tokenName.indexOf('.');
    if (dotIndex > 0) {
        const actionId = tokenName.substring(0, dotIndex);
        const tokenKey = tokenName.substring(dotIndex + 1);
        const actionResult = context.previousResults.get(actionId);
        if (actionResult) {
            return actionResult.tokens[tokenKey];
        }
    }

    return undefined;
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

    // Replace workflow context tokens ({{workflow.selection}}, {{workflow.clipboard}}, etc.)
    promptText = replaceWorkflowContextTokens(promptText, context.workflowContext);

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

    // Resolve the source URL from the configured token
    const sourceUrlToken = action.transcriptionContext?.sourceUrlToken ?? 'workflow.clipboard';
    const sourceUrl = resolveTokenValue(sourceUrlToken, context);

    if (!sourceUrl || !sourceUrl.trim()) {
        return { ...baseResult, error: `No URL found in token {{${sourceUrlToken}}}` };
    }

    // Get per-action browser/cookie settings (required, with defaults)
    const extractionSettings = {
        impersonateBrowser: action.transcriptionContext?.impersonateBrowser ?? 'chrome',
        useBrowserCookies: action.transcriptionContext?.useBrowserCookies ?? false
    };

    const inputHandler = new TokenUrlInputHandler(sourceUrl, extractionSettings);

    // Create a minimal workflow-like object for InputContext compatibility
    const inputContext: InputContext = {
        app: context.app,
        settings: context.settings,
        workflow: {
            id: action.id,
            name: action.name,
            actions: [],
            outputType: 'popup',
            outputFolder: '',
            showInCommandPalette: false
        }
    };

    try {
        logDebug(LogCategory.TRANSCRIPTION, `Executing transcription action: ${action.name}`);

        const inputResult = await inputHandler.getInput(inputContext);
        if (!inputResult) {
            return { ...baseResult, error: 'Failed to extract audio from URL' };
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
 * Execute an HTTP request action and return the result.
 */
export async function executeHttpRequestAction(
    action: HttpRequestAction,
    context: ActionExecutionContext
): Promise<ActionExecutionResult> {
    const baseResult: ActionExecutionResult = {
        actionId: action.id,
        actionType: 'http-request',
        success: false,
        tokens: {}
    };

    // Resolve the URL from the configured token
    const sourceUrlToken = action.sourceUrlToken ?? 'workflow.clipboard';
    const url = resolveTokenValue(sourceUrlToken, context);

    if (!url || !url.trim()) {
        return { ...baseResult, error: `No URL found in token {{${sourceUrlToken}}}` };
    }

    try {
        logDebug(LogCategory.WORKFLOW, `Executing HTTP request action: ${action.name} -> ${url}`);

        const response = await requestUrl({
            url: url.trim(),
            method: 'GET'
        });

        logInfo(LogCategory.WORKFLOW, `HTTP request completed: ${action.name} (status: ${response.status})`);

        return {
            ...baseResult,
            success: true,
            tokens: createHttpRequestWorkflowTokens(url.trim(), response.status, response.text)
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
    } else if (action.type === 'transcription') {
        return executeTranscriptionAction(action, context);
    } else {
        return executeHttpRequestAction(action, context);
    }
}

