import { App, MarkdownView } from 'obsidian';
import { WorkflowConfig, AIToolboxSettings, TimestampGranularity } from '../settings';
import { TranscriptionResult, TranscriptionChunk } from '../providers';

/**
 * Result from executing a workflow, used for chaining
 */
export interface WorkflowExecutionResult {
    /** The workflow that was executed */
    workflowId: string;
    /** The workflow type */
    workflowType: 'chat' | 'transcription';
    /** Whether execution succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Token values produced by the workflow */
    tokens: Record<string, string>;
}

/**
 * Map of workflow ID to execution results
 */
export type WorkflowResultsMap = Map<string, WorkflowExecutionResult>;

/**
 * Detect circular dependencies in a workflow's dependency chain.
 * Currently workflows don't have cross-workflow dependencies (actions chain within a workflow).
 * This function is kept for potential future use.
 */
export function detectCircularDependency(
    _workflow: WorkflowConfig,
    _settings: AIToolboxSettings,
    _visited: Set<string> = new Set(),
    _path: string[] = []
): string[] {
    // No cross-workflow dependencies in current design
    return [];
}

/**
 * Check if a workflow has any workflow dependencies configured.
 * Currently workflows don't have cross-workflow dependencies.
 */
export function hasWorkflowDependencies(_workflow: WorkflowConfig): boolean {
    return false;
}

/**
 * Replace workflow context tokens in a prompt with actual values from executed dependencies.
 * Tokens are in the format {{workflowId.tokenName}}
 */
export function replaceWorkflowTokens(
    promptText: string,
    results: WorkflowResultsMap
): string {
    // Match tokens like {{workflowId.tokenName}}
    const tokenPattern = /\{\{([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)\}\}/g;

    return promptText.replace(tokenPattern, (match, workflowId: string, tokenName: string) => {
        const result = results.get(workflowId);
        if (!result) {
            // Workflow not executed or not found - leave token as-is
            console.warn(`Workflow result not found for token: ${match}`);
            return match;
        }

        const tokenValue = result.tokens[tokenName];
        if (tokenValue === undefined) {
            // Token not found in results - leave as-is
            console.warn(`Token "${tokenName}" not found in workflow "${workflowId}" results`);
            return match;
        }

        return tokenValue;
    });
}

/**
 * Create chat workflow tokens from execution data
 */
export function createChatWorkflowTokens(
    promptText: string,
    responseText: string
): Record<string, string> {
    return {
        prompt: promptText,
        response: responseText
    };
}

/**
 * Format a timestamp in seconds to MM:SS or HH:MM:SS format.
 */
export function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format transcription chunks with timestamps.
 * Each segment is prefixed with its start time in [MM:SS] format.
 */
export function formatTranscriptionWithTimestamps(chunks: TranscriptionChunk[]): string {
    if (!chunks || chunks.length === 0) {
        return '';
    }

    return chunks
        .map(chunk => `[${formatTimestamp(chunk.timestamp[0])}] ${chunk.text}`)
        .join('\n');
}

/**
 * Create transcription workflow tokens from execution data.
 * Generates plain text transcription and optionally timestamped version.
 * The transcriptionWithTimestamps token is only included when granularity is not 'disabled'.
 */
export function createTranscriptionWorkflowTokens(
    transcriptionResult: TranscriptionResult,
    metadata?: {
        title?: string;
        uploader?: string;
        sourceUrl?: string;
        description?: string;
        tags?: string[];
    },
    timestampGranularity?: TimestampGranularity
): Record<string, string> {
    const tokens: Record<string, string> = {
        transcription: transcriptionResult.text,
        title: metadata?.title ?? '',
        author: metadata?.uploader ?? '',
        sourceUrl: metadata?.sourceUrl ?? '',
        description: metadata?.description ?? '',
        tags: metadata?.tags?.join(', ') ?? ''
    };

    // Only include timestamped transcription when timestamps are enabled
    if (timestampGranularity !== 'disabled') {
        tokens.transcriptionWithTimestamps = formatTranscriptionWithTimestamps(transcriptionResult.chunks);
    }

    return tokens;
}

/**
 * Get ordered list of dependency workflow IDs for a workflow.
 * Currently workflows don't have cross-workflow dependencies.
 */
export function getDependencyWorkflowIds(_workflow: WorkflowConfig): string[] {
    return [];
}

/**
 * Context token values for replacement in prompts
 */
export interface ContextTokenValues {
    /** The currently selected text in the editor */
    selection?: string;
    /** The full contents of the active file */
    activeTabContent?: string;
    /** The filename of the active file */
    activeTabFilename?: string;
    /** The clipboard contents */
    clipboard?: string;
}

/**
 * Gather context values from the current editor/clipboard state.
 * This retrieves selection, active tab content, filename, and clipboard for token replacement.
 */
export async function gatherContextValues(app: App): Promise<ContextTokenValues> {
    const values: ContextTokenValues = {};

    const activeView = app.workspace.getActiveViewOfType(MarkdownView);

    if (activeView) {
        const editor = activeView.editor;
        const selection = editor.getSelection();
        if (selection && selection.trim()) {
            values.selection = selection;
        }

        const file = activeView.file;
        if (file) {
            values.activeTabFilename = file.name;
            try {
                values.activeTabContent = await app.vault.read(file);
            } catch {
                // Ignore read errors
            }
        }
    }

    try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.trim()) {
            values.clipboard = clipboardText;
        }
    } catch {
        // Ignore clipboard access errors
    }

    return values;
}

/**
 * Replace context tokens in a prompt with actual values.
 * Handles simple tokens like {{selection}}, {{clipboard}}, {{activeTabContent}}, {{activeTabFilename}}.
 */
export function replaceContextTokens(
    promptText: string,
    values: ContextTokenValues
): string {
    // Match simple tokens like {{selection}} (no dot, simple alphanumeric name)
    const tokenPattern = /\{\{([a-zA-Z]+)\}\}/g;

    return promptText.replace(tokenPattern, (match, tokenName: string) => {
        switch (tokenName) {
            case 'selection':
                return values.selection ?? match;
            case 'activeTabContent':
                return values.activeTabContent ?? match;
            case 'activeTabFilename':
                return values.activeTabFilename ?? match;
            case 'clipboard':
                return values.clipboard ?? match;
            default:
                // Unknown token - leave as-is
                return match;
        }
    });
}

/**
 * Check if a prompt contains any context tokens that need replacement.
 */
export function hasContextTokens(promptText: string): boolean {
    const contextTokens = ['selection', 'activeTabContent', 'activeTabFilename', 'clipboard'];
    return contextTokens.some(token => promptText.includes(`{{${token}}}`));
}

