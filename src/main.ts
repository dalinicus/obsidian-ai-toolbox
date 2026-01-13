import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, AIToolboxSettings, AIToolboxSettingTab, WorkflowConfig } from "./settings/index";
import { WorkflowSuggesterModal } from "./components/workflow-suggester";
import { executeWorkflow } from "./processing/workflow-executor";
import { VIEW_TYPE_LOG, LogPaneView, logInfo, logNotice, LogCategory } from "./logging";

// Command ID prefix for workflow commands
const WORKFLOW_COMMAND_PREFIX = 'execute-workflow-';

export default class AIToolboxPlugin extends Plugin {
	settings: AIToolboxSettings;
	// Track registered workflow command IDs for cleanup
	private registeredWorkflowCommandIds: Set<string> = new Set();

	async onload() {
		await this.loadSettings();

		// Register log view
		this.registerView(VIEW_TYPE_LOG, (leaf) => new LogPaneView(leaf, this));

		// Add ribbon icon for log view
		this.addRibbonIcon('scroll-text', 'Show AI toolbox log', () => {
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

		// Register individual workflow commands
		this.registerWorkflowCommands();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIToolboxSettingTab(this.app, this));

		logInfo(LogCategory.PLUGIN, 'AI Toolbox plugin loaded');
	}

	onunload() {
		// Log views are cleaned up automatically by Obsidian when the plugin unloads
		// Workflow commands are also cleaned up automatically when the plugin unloads
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
			await workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Show the workflow suggester modal and execute the selected workflow.
	 */
	private showWorkflowSuggester(): void {
		const availableWorkflows = this.settings.workflows;

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
		// Re-register workflow commands to pick up any changes
		this.registerWorkflowCommands();
	}

	/**
	 * Get the command ID for a workflow.
	 */
	private getWorkflowCommandId(workflow: WorkflowConfig): string {
		return `${WORKFLOW_COMMAND_PREFIX}${workflow.id}`;
	}

	/**
	 * Register individual workflow commands for workflows with showInCommandPalette enabled.
	 * This method handles both initial registration and updates when settings change.
	 */
	private registerWorkflowCommands(): void {
		// Build the set of command IDs that should be registered
		const shouldBeRegistered = new Set<string>();
		for (const workflow of this.settings.workflows) {
			if (workflow.showInCommandPalette) {
				shouldBeRegistered.add(this.getWorkflowCommandId(workflow));
			}
		}

		// Remove commands that should no longer be registered
		for (const commandId of this.registeredWorkflowCommandIds) {
			if (!shouldBeRegistered.has(commandId)) {
				this.unregisterWorkflowCommand(commandId);
				this.registeredWorkflowCommandIds.delete(commandId);
			}
		}

		// Register new commands
		for (const workflow of this.settings.workflows) {
			if (!workflow.showInCommandPalette) {
				continue;
			}

			const commandId = this.getWorkflowCommandId(workflow);
			if (!this.registeredWorkflowCommandIds.has(commandId)) {
				this.addCommand({
					id: commandId,
					name: `Run workflow: ${workflow.name}`,
					callback: () => {
						void executeWorkflow(this.app, this.settings, workflow);
					}
				});
				this.registeredWorkflowCommandIds.add(commandId);
			}
		}
	}

	/**
	 * Unregister a workflow command by its ID.
	 */
	private unregisterWorkflowCommand(commandId: string): void {
		// Access the internal commands API to remove commands
		/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
		const commands = (this.app as any).commands;
		if (commands && typeof commands.removeCommand === 'function') {
			commands.removeCommand(`${this.manifest.id}:${commandId}`);
		}
		/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
	}
}
