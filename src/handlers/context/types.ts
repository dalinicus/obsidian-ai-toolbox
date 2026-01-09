import { App } from 'obsidian';
import { WorkflowConfig, ChatContextType } from '../../settings';
import { TokenDefinition } from '../../tokens';

// Re-export types from settings for convenience
export type { ChatContextType, ChatContextConfig } from '../../settings';

/**
 * Display labels for context types
 */
export const CHAT_CONTEXT_TYPE_LABELS: Record<ChatContextType, string> = {
    'selection': 'Selection',
    'active-tab': 'Active Tab File Contents',
    'clipboard': 'Clipboard'
};

/**
 * Descriptions for context types
 */
export const CHAT_CONTEXT_TYPE_DESCRIPTIONS: Record<ChatContextType, string> = {
    'selection': 'The currently selected text in the editor',
    'active-tab': 'The full contents of the currently active file',
    'clipboard': 'The current contents of the system clipboard'
};

/**
 * Context provided to context handlers
 */
export interface ContextHandlerContext {
    /** The Obsidian App instance */
    app: App;
    /** The workflow configuration being executed */
    workflow: WorkflowConfig;
}

/**
 * Result from getting context content
 */
export interface ContextResult {
    /** The content retrieved from the context source */
    content: string;
    /** Whether the context was successfully retrieved */
    success: boolean;
    /** Error message if the context retrieval failed */
    error?: string;
}

/**
 * Interface for context handlers that provide content for chat workflows.
 * 
 * Context handlers retrieve content from various sources (selection, clipboard, etc.)
 * and provide token definitions for use in prompts.
 */
export interface ContextHandler {
    /**
     * Get the type of context this handler provides.
     */
    readonly contextType: ChatContextType;

    /**
     * Get the token definitions this context handler provides.
     * These tokens can be used in prompts to reference the context content.
     */
    getAvailableTokens(): TokenDefinition[];

    /**
     * Get the content from this context source.
     * 
     * @param context - Context information about the workflow execution
     * @returns Promise that resolves with the context result
     */
    getContent(context: ContextHandlerContext): Promise<ContextResult>;
}

