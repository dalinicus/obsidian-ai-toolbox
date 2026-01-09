import { App, MarkdownView } from 'obsidian';
import { WorkflowConfig, AIToolboxSettings } from '../settings';

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
 * Context for tracking workflow dependency execution
 */
export interface DependencyExecutionContext {
    /** The Obsidian App instance */
    app: App;
    /** Plugin settings */
    settings: AIToolboxSettings;
    /** Results from executed dependencies */
    results: WorkflowResultsMap;
    /** Workflow IDs currently in the execution stack (for circular detection) */
    executionStack: Set<string>;
}

/**
 * Detect circular dependencies in a workflow's dependency chain.
 * Returns an array of workflow names forming the cycle, or empty if no cycle.
 */
export function detectCircularDependency(
    workflow: WorkflowConfig,
    settings: AIToolboxSettings,
    visited: Set<string> = new Set(),
    path: string[] = []
): string[] {
    if (visited.has(workflow.id)) {
        // Found a cycle - return the path from the first occurrence
        const cycleStart = path.indexOf(workflow.name);
        return [...path.slice(cycleStart), workflow.name];
    }

    visited.add(workflow.id);
    path.push(workflow.name);

    const workflowContexts = workflow.workflowContexts ?? [];
    for (const ctx of workflowContexts) {
        const depWorkflow = settings.workflows.find(w => w.id === ctx.workflowId);
        if (depWorkflow) {
            const cycle = detectCircularDependency(depWorkflow, settings, visited, path);
            if (cycle.length > 0) {
                return cycle;
            }
        }
    }

    path.pop();
    return [];
}

/**
 * Check if a workflow has any workflow dependencies configured
 */
export function hasWorkflowDependencies(workflow: WorkflowConfig): boolean {
    return (workflow.workflowContexts?.length ?? 0) > 0;
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
 * Create transcription workflow tokens from execution data
 */
export function createTranscriptionWorkflowTokens(
    transcriptionText: string,
    metadata?: {
        title?: string;
        uploader?: string;
        sourceUrl?: string;
        description?: string;
        tags?: string[];
    }
): Record<string, string> {
    return {
        transcription: transcriptionText,
        title: metadata?.title ?? '',
        author: metadata?.uploader ?? '',
        sourceUrl: metadata?.sourceUrl ?? '',
        description: metadata?.description ?? '',
        tags: metadata?.tags?.join(', ') ?? ''
    };
}

/**
 * Get ordered list of dependency workflow IDs for a workflow
 */
export function getDependencyWorkflowIds(workflow: WorkflowConfig): string[] {
    return (workflow.workflowContexts ?? []).map(ctx => ctx.workflowId);
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

