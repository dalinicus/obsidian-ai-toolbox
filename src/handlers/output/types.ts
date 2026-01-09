import { App } from 'obsidian';
import { WorkflowConfig } from '../../settings';

/**
 * Context provided to output handlers for handling workflow results.
 */
export interface OutputContext {
    /** The Obsidian App instance */
    app: App;
    /** The workflow configuration that was executed */
    workflow: WorkflowConfig;
    /** The prompt text that was sent to the AI (for chat workflows) */
    promptText?: string;
    /** Custom note title (for new-note output handler) */
    noteTitle?: string;
}

/**
 * Common interface for output handlers.
 * 
 * Each output handler handles a specific way of presenting or storing
 * the AI model's response (e.g., popup modal, new note, cursor insertion).
 */
export interface OutputHandler {
    /**
     * Handle the AI model's response output.
     * 
     * @param responseText - The text response from the AI model
     * @param context - Context information about the workflow execution
     * @returns Promise that resolves when output handling is complete
     */
    handleOutput(responseText: string, context: OutputContext): Promise<void>;
}

