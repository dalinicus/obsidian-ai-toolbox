import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, AIToolboxSettings, AIToolboxSettingTab } from "./settings/index";
import { WorkflowSuggesterModal } from "./components/workflow-suggester";
import { executeWorkflow } from "./processing/workflow-executor";

export default class AIToolboxPlugin extends Plugin {
	settings: AIToolboxSettings;

	async onload() {
		await this.loadSettings();

		// Add command to execute custom workflows
		this.addCommand({
			id: 'execute-workflow',
			name: 'Run workflow',
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
			new Notice('No workflows available. You can configure workflows from the workflows tab in settings.');
			return;
		}

		const modal = new WorkflowSuggesterModal(this.app, availableWorkflows, (workflow) => {
			void executeWorkflow(this.app, this.settings, workflow);
		});
		modal.open();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AIToolboxSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
