import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, AIToolboxSettings, AIToolboxSettingTab } from "./settings/index";
import { createTranscriptionProvider } from "./providers";
import { transcribeFromClipboard } from "./transcriptions/transcription-workflow";
import { PromptSuggesterModal, executePrompt } from "./prompts";

export default class AIToolboxPlugin extends Plugin {
	settings: AIToolboxSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon for video transcription.
		this.addRibbonIcon('captions', 'Transcribe video from clipboard', () => {
			void this.transcribeFromClipboard();
		});

		// Add command to execute custom prompts
		this.addCommand({
			id: 'execute-prompt',
			name: 'Execute custom prompt',
			callback: () => this.showPromptSuggester()
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIToolboxSettingTab(this.app, this));
	}

	/**
	 * Show the prompt suggester modal and execute the selected prompt.
	 */
	private showPromptSuggester(): void {
		const prompts = this.settings.prompts;

		if (prompts.length === 0) {
			new Notice('No prompts configured. Please add prompts in settings.');
			return;
		}

		const modal = new PromptSuggesterModal(this.app, prompts, (prompt) => {
			void executePrompt(this.app, this.settings, prompt);
		});
		modal.open();
	}

	/**
	 * Complete workflow: Extract audio from clipboard URL, transcribe it, and create a note.
	 */
	async transcribeFromClipboard(): Promise<void> {
		// Create the transcription provider from settings
		const provider = createTranscriptionProvider(this.settings);
		if (!provider) {
			new Notice('No transcription provider configured. Please configure a provider in settings.');
			return;
		}

		// Build workflow options from settings
		const options = {
			includeTimestamps: this.settings.includeTimestamps,
			language: this.settings.transcriptionLanguage || undefined,
			outputFolder: this.settings.outputFolder,
		};

		await transcribeFromClipboard(this.app, provider, this.settings, options);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AIToolboxSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
