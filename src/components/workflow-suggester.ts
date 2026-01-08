import { App, FuzzySuggestModal } from 'obsidian';
import { WorkflowConfig } from '../settings';

/**
 * Modal for selecting a workflow from the configured workflows list.
 * Uses fuzzy search to filter workflows by name.
 */
export class WorkflowSuggesterModal extends FuzzySuggestModal<WorkflowConfig> {
	private workflows: WorkflowConfig[];
	private onChoose: (workflow: WorkflowConfig) => void;

	constructor(app: App, workflows: WorkflowConfig[], onChoose: (workflow: WorkflowConfig) => void) {
		super(app);
		this.workflows = workflows;
		this.onChoose = onChoose;
		this.setPlaceholder('Select a workflow to execute...');
	}

	getItems(): WorkflowConfig[] {
		return this.workflows;
	}

	getItemText(workflow: WorkflowConfig): string {
		return workflow.name;
	}

	onChooseItem(workflow: WorkflowConfig): void {
		this.onChoose(workflow);
	}
}

