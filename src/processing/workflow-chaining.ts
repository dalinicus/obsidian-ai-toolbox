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
    workflowType: 'chat' | 'transcription' | 'http-request';
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
 * Create HTTP request workflow tokens from execution data
 */
export function createHttpRequestWorkflowTokens(
    url: string,
    statusCode: number,
    responseBody: string
): Record<string, string> {
    return {
        url,
        statusCode: String(statusCode),
        responseBody
    };
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
    fileContent?: string;
    /** The path of the active file */
    filePath?: string;
    /** The clipboard contents */
    clipboard?: string;
}

/**
 * Gather context values from the current editor/clipboard state.
 * This retrieves selection, file content, file path, and clipboard for token replacement.
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
            values.filePath = file.path;
            try {
                values.fileContent = await app.vault.read(file);
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
 * Replace workflow context tokens in a prompt with actual values.
 * Handles tokens like {{workflow.selection}}, {{workflow.clipboard}},
 * {{workflow.file.content}}, {{workflow.file.path}}.
 *
 * These tokens are gathered once at workflow start and shared across all actions.
 */
export function replaceWorkflowContextTokens(
    promptText: string,
    values: ContextTokenValues
): string {
    // Match workflow context tokens like {{workflow.selection}} or {{workflow.file.content}}
    const tokenPattern = /\{\{workflow\.([a-zA-Z.]+)\}\}/g;

    return promptText.replace(tokenPattern, (match, tokenName: string) => {
        switch (tokenName) {
            case 'selection':
                return values.selection ?? match;
            case 'file.content':
                return values.fileContent ?? match;
            case 'file.path':
                return values.filePath ?? match;
            case 'clipboard':
                return values.clipboard ?? match;
            default:
                // Unknown token - leave as-is
                return match;
        }
    });
}

