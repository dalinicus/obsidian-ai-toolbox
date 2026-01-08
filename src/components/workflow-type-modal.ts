import { App, Modal, setIcon } from "obsidian";
import { WorkflowType } from "../settings";

/**
 * Modal for selecting the type of workflow to create
 */
export class WorkflowTypeModal extends Modal {
	private onSelect: (type: WorkflowType) => void;

	constructor(app: App, onSelect: (type: WorkflowType) => void) {
		super(app);
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('workflow-type-modal');

		// Title
		contentEl.createEl('h2', { text: 'Select workflow type' });

		// Description
		contentEl.createEl('p', { 
			text: 'Choose the type of workflow you want to create:',
			cls: 'workflow-type-description'
		});

		// Options container
		const optionsContainer = contentEl.createDiv('workflow-type-options');

		// Chat option
		const chatOption = optionsContainer.createDiv('workflow-type-option');
		chatOption.addEventListener('click', () => {
			this.onSelect('chat');
			this.close();
		});

		const chatIcon = chatOption.createDiv('workflow-type-icon');
		setIcon(chatIcon, 'message-circle');

		const chatContent = chatOption.createDiv('workflow-type-content');
		chatContent.createEl('h3', { text: 'Chat' });
		chatContent.createEl('p', { text: 'Send prompts to AI models and receive text responses' });

		// Transcription option
		const transcriptionOption = optionsContainer.createDiv('workflow-type-option');
		transcriptionOption.addEventListener('click', () => {
			this.onSelect('transcription');
			this.close();
		});

		const transcriptionIcon = transcriptionOption.createDiv('workflow-type-icon');
		setIcon(transcriptionIcon, 'audio-lines');

		const transcriptionContent = transcriptionOption.createDiv('workflow-type-content');
		transcriptionContent.createEl('h3', { text: 'Transcription' });
		transcriptionContent.createEl('p', { text: 'Transcribe audio or video files using AI models' });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

