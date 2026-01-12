import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, AIToolboxSettings, AIToolboxSettingTab } from "./settings/index";
import { WorkflowSuggesterModal } from "./components/workflow-suggester";
import { executeWorkflow } from "./processing/workflow-executor";
import { VIEW_TYPE_LOG, LogPaneView, logInfo, logNotice, LogCategory } from "./logging";

export default class AIToolboxPlugin extends Plugin {
	settings: AIToolboxSettings;

	async onload() {
		await this.loadSettings();

		// Register log view
		this.registerView(VIEW_TYPE_LOG, (leaf) => new LogPaneView(leaf, this));

		// Add ribbon icon for log view
		this.addRibbonIcon('scroll-text', 'Show AI Toolbox Log', () => {
			void this.activateLogView();
		});

		// Add command to execute custom workflows
		this.addCommand({
			id: 'execute-workflow',
			name: 'Run workflow',
			callback: () => this.showWorkflowSuggester()
		});

		// Add command to show log view
		this.addCommand({
			id: 'show-log',
			name: 'Show log',
			callback: () => {
				void this.activateLogView();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIToolboxSettingTab(this.app, this));

		logInfo(LogCategory.PLUGIN, 'AI Toolbox plugin loaded');
	}

	onunload() {
		// Clean up log view leaves
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_LOG);
	}

	/**
	 * Activate and reveal the log view in the right sidebar.
	 */
	private async activateLogView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_LOG)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({ type: VIEW_TYPE_LOG, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Show the workflow suggester modal and execute the selected workflow.
	 */
	private showWorkflowSuggester(): void {
		const availableWorkflows = this.settings.workflows.filter(w => w.showInCommand);

		if (availableWorkflows.length === 0) {
			logNotice(LogCategory.WORKFLOW, 'No workflows available. You can configure workflows from the workflows tab in settings.');
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
