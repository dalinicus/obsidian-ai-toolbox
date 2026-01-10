import { App } from 'obsidian';
import { LLMToolboxSettings, WorkflowConfig } from '../../settings';
import { VideoMetadata } from '../../processing';

/**
 * Result from acquiring input for transcription.
 * Contains the audio file path and optional metadata.
 */
export interface InputResult {
    /** Absolute path to the audio file */
    audioFilePath: string;
    /** Source URL if the audio was extracted from a video URL */
    sourceUrl?: string;
    /** Metadata from the video/audio source */
    metadata?: VideoMetadata;
}

/**
 * Context provided to input handlers for acquiring transcription input.
 */
export interface InputContext {
    /** The Obsidian App instance */
    app: App;
    /** Plugin settings */
    settings: LLMToolboxSettings;
    /** The workflow configuration being executed */
    workflow: WorkflowConfig;
}

/**
 * Common interface for input handlers.
 * 
 * Each input handler handles a specific way of acquiring media input
 * for transcription (e.g., file selection, clipboard URL, selection URL).
 */
export interface InputHandler {
    /**
     * Acquire input for transcription.
     * 
     * @param context - Context information about the workflow execution
     * @returns Promise that resolves with the input result, or null if cancelled/failed
     */
    getInput(context: InputContext): Promise<InputResult | null>;
}

