import { App, Notice } from 'obsidian';
import { AIToolboxSettings } from '../settings';
import { extractAudioFromClipboard } from './video-downloader';
import { transcribe } from './whisper-transcriber';
import { createTranscriptionNote, openTranscriptionNote } from './transcription-note';
import * as fs from 'fs';

/**
 * Complete workflow: Extract audio from clipboard URL, transcribe it, and create a note.
 * 
 * @param app - Obsidian App instance
 * @param settings - Plugin settings
 */
export async function transcribeFromClipboard(app: App, settings: AIToolboxSettings): Promise<void> {
    try {
        // Step 1: Extract audio from clipboard URL
        const extractResult = await extractAudioFromClipboard(settings);

        if (!extractResult) {
            // Error already shown by extractAudioFromClipboard
            return;
        }

        const { audioFilePath, sourceUrl, metadata } = extractResult;

        // Step 2: Transcribe the audio using Whisper
        const transcriptionResult = await transcribe(
            audioFilePath,
            {
                endpoint: settings.azureEndpoint,
                apiKey: settings.azureApiKey,
                deploymentName: settings.azureDeploymentName,
            },
            {
                includeTimestamps: settings.includeTimestamps,
                language: settings.transcriptionLanguage || undefined
            }
        );

        // Step 3: Create a note with the transcription and video metadata
        const noteFile = await createTranscriptionNote(
            app,
            transcriptionResult,
            sourceUrl,
            settings.includeTimestamps,
            settings.outputFolder,
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

