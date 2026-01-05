import {Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, AIToolboxSettings, AIToolboxSettingTab} from "./settings";
import {extractAudioFromClipboard} from "./video-downloader";
import {transcribe} from "./whisper-transcriber";
import {createTranscriptionNote, openTranscriptionNote} from "./transcription-note";
import * as fs from 'fs';

export default class AIToolboxPlugin extends Plugin {
	settings: AIToolboxSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon for video transcription.
		this.addRibbonIcon('captions', 'Transcribe video from clipboard', () => {
			void this.transcribeFromClipboard();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIToolboxSettingTab(this.app, this));
	}

	/**
	 * Complete workflow: Extract audio from clipboard URL, transcribe it, and create a note.
	 */
	async transcribeFromClipboard(): Promise<void> {
		try {
			// Step 1: Extract audio from clipboard URL
			const extractResult = await extractAudioFromClipboard(this.settings);

			if (!extractResult) {
				// Error already shown by extractAudioFromClipboard
				return;
			}

			const {audioFilePath, sourceUrl, metadata} = extractResult;

			// Step 2: Transcribe the audio using Whisper
			const transcriptionResult = await transcribe(
				audioFilePath,
				{
					endpoint: this.settings.azureEndpoint,
					apiKey: this.settings.azureApiKey,
					deploymentName: this.settings.azureDeploymentName,
				},
				{
					includeTimestamps: this.settings.includeTimestamps,
					language: this.settings.transcriptionLanguage || undefined
				}
			);

			// Step 3: Create a note with the transcription and video metadata
			const noteFile = await createTranscriptionNote(
				this.app,
				transcriptionResult,
				sourceUrl,
				this.settings.includeTimestamps,
				this.settings.outputFolder,
				metadata
			);

			// Step 4: Clean up the audio file
			try {
				await fs.promises.unlink(audioFilePath);
			} catch (cleanupError) {
				console.warn('Failed to clean up audio file:', cleanupError);
			}

			// Step 5: Open the note
			await openTranscriptionNote(this.app, noteFile);

			new Notice('Transcription complete! Note opened.');

		} catch (error) {
			console.error('Transcription workflow error:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			new Notice(`Transcription failed: ${errorMessage}`);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AIToolboxSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
