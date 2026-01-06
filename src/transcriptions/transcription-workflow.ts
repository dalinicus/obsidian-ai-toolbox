import { App, Notice } from 'obsidian';
import { AIToolboxSettings } from '../settings';
import { ModelProvider, TranscriptionOptions } from '../providers';
import { extractAudioFromClipboard } from './video-downloader';
import { createTranscriptionNote, openTranscriptionNote } from './transcription-note';
import * as fs from 'fs';

/**
 * Options for the transcription workflow
 */
export interface TranscriptionWorkflowOptions {
    includeTimestamps: boolean;
    language?: string;
    outputFolder?: string;
}

/**
 * Complete workflow: Extract audio from clipboard URL, transcribe it, and create a note.
 * Uses dependency injection for the model provider, making the workflow provider-agnostic.
 *
 * @param app - Obsidian App instance
 * @param provider - The model provider to use for transcription
 * @param settings - Plugin settings for audio extraction configuration
 * @param options - Transcription workflow options
 */
export async function transcribeFromClipboard(
    app: App,
    provider: ModelProvider,
    settings: AIToolboxSettings,
    options: TranscriptionWorkflowOptions
): Promise<void> {
    try {
        // Validate provider supports transcription
        if (!provider.supportsTranscription()) {
            new Notice(`Provider "${provider.providerName}" does not support transcription.`);
            return;
        }

        // Step 1: Extract audio from clipboard URL
        const extractResult = await extractAudioFromClipboard(settings);

        if (!extractResult) {
            // Error already shown by extractAudioFromClipboard
            return;
        }

        const { audioFilePath, sourceUrl, metadata } = extractResult;

        // Step 2: Transcribe the audio using the injected provider
        const transcriptionOptions: TranscriptionOptions = {
            includeTimestamps: options.includeTimestamps,
            language: options.language,
        };
        const transcriptionResult = await provider.transcribeAudio(audioFilePath, transcriptionOptions);

        // Step 3: Create a note with the transcription and video metadata
        const noteFile = await createTranscriptionNote(
            app,
            transcriptionResult,
            sourceUrl,
            options.includeTimestamps,
            options.outputFolder || '',
            metadata
        );

        // Step 4: Clean up the audio file
        try {
            await fs.promises.unlink(audioFilePath);
        } catch (cleanupError) {
            console.warn('Failed to clean up audio file:', cleanupError);
        }

        // Step 5: Open the note
        await openTranscriptionNote(app, noteFile);

        new Notice('Transcription complete! Note opened.');

    } catch (error) {
        console.error('Transcription workflow error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        new Notice(`Transcription failed: ${errorMessage}`);
    }
}

