import { App, FuzzySuggestModal } from 'obsidian';
import { PromptConfig } from '../settings';

/**
 * Modal for selecting a prompt from the configured prompts list.
 * Uses fuzzy search to filter prompts by name.
 */
export class PromptSuggesterModal extends FuzzySuggestModal<PromptConfig> {
	private prompts: PromptConfig[];
	private onChoose: (prompt: PromptConfig) => void;

	constructor(app: App, prompts: PromptConfig[], onChoose: (prompt: PromptConfig) => void) {
		super(app);
		this.prompts = prompts;
		this.onChoose = onChoose;
		this.setPlaceholder('Select a prompt to execute...');
	}

	getItems(): PromptConfig[] {
		return this.prompts;
	}

	getItemText(prompt: PromptConfig): string {
		return prompt.name;
	}

	onChooseItem(prompt: PromptConfig): void {
		this.onChoose(prompt);
	}
}

