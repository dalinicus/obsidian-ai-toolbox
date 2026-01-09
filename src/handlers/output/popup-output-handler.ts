import { App, Modal, Notice } from 'obsidian';
import { OutputHandler, OutputContext } from './types';

/**
 * Modal to display the AI response from a workflow execution.
 */
export class WorkflowResultModal extends Modal {
    private workflowName: string;
    private response: string;

    constructor(app: App, workflowName: string, response: string) {
        super(app);
        this.workflowName = workflowName;
        this.response = response;
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: this.workflowName });

        const responseContainer = contentEl.createDiv('workflow-response-container');
        responseContainer.createEl('pre', {
            text: this.response,
            cls: 'workflow-response-content'
        });

        // Add copy button
        const buttonContainer = contentEl.createDiv('workflow-response-buttons');
        const copyButton = buttonContainer.createEl('button', { text: 'Copy to clipboard' });
        copyButton.addEventListener('click', () => {
            void navigator.clipboard.writeText(this.response).then(() => {
                new Notice('Response copied to clipboard');
            });
        });

        const closeButton = buttonContainer.createEl('button', { text: 'Close' });
        closeButton.addEventListener('click', () => this.close());
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Output handler that displays the AI response in a modal popup.
 */
export class PopupOutputHandler implements OutputHandler {
    async handleOutput(responseText: string, context: OutputContext): Promise<void> {
        const modal = new WorkflowResultModal(
            context.app,
            context.workflow.name,
            responseText
        );
        modal.open();
    }
}

