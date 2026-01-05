import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, AIToolboxSettings, AIToolboxSettingTab } from "./settings";
import { transcribeFromClipboard } from "./transcriptions/transcription-workflow";

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
		await transcribeFromClipboard(this.app, this.settings);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AIToolboxSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
