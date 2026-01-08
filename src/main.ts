import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, AIToolboxSettings, AIToolboxSettingTab } from "./settings/index";
import { createTranscriptionProvider } from "./providers";
import { transcribeFromClipboard } from "./transcriptions/transcription-workflow";
import { WorkflowSuggesterModal, executeWorkflow } from "./workflows";

export default class AIToolboxPlugin extends Plugin {
	settings: AIToolboxSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon for video transcription.
		this.addRibbonIcon('captions', 'Transcribe video from clipboard', () => {
			void this.transcribeFromClipboard();
		});

		// Add command to execute custom workflows
		this.addCommand({
			id: 'execute-workflow',
			name: 'Run AI Workflow',
			callback: () => this.showWorkflowSuggester()
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIToolboxSettingTab(this.app, this));
	}

	/**
	 * Show the workflow suggester modal and execute the selected workflow.
	 */
	private showWorkflowSuggester(): void {
		const availableWorkflows = this.settings.workflows.filter(w => w.showInCommand);

		if (availableWorkflows.length === 0) {
			new Notice('No workflows available. You can configure workloads from the "Workflows" tab in settings.');
			return;
		}

		const modal = new WorkflowSuggesterModal(this.app, availableWorkflows, (workflow) => {
			void executeWorkflow(this.app, this.settings, workflow);
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
