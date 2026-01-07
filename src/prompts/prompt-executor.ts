import { App, Modal, Notice } from 'obsidian';
import { PromptConfig, AIToolboxSettings } from '../settings';
import { createPromptProvider, ChatMessage } from '../providers';

/**
 * Modal to display the AI response from a prompt execution
 */
export class PromptResultModal extends Modal {
	private promptName: string;
	private response: string;

	constructor(app: App, promptName: string, response: string) {
		super(app);
		this.promptName = promptName;
		this.response = response;
	}

	onOpen(): void {
		const { contentEl } = this;
		
		contentEl.createEl('h2', { text: this.promptName });
		
		const responseContainer = contentEl.createDiv('prompt-response-container');
		responseContainer.createEl('pre', { 
			text: this.response,
			cls: 'prompt-response-content'
		});

		// Add copy button
		const buttonContainer = contentEl.createDiv('prompt-response-buttons');
		const copyButton = buttonContainer.createEl('button', { text: 'Copy to clipboard' });
		copyButton.addEventListener('click', async () => {
			await navigator.clipboard.writeText(this.response);
			new Notice('Response copied to clipboard');
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
 * Execute a prompt using its configured provider and display the result.
 * 
 * @param app - Obsidian App instance
 * @param settings - Plugin settings
 * @param prompt - The prompt configuration to execute
 */
export async function executePrompt(
	app: App,
	settings: AIToolboxSettings,
	prompt: PromptConfig
): Promise<void> {
	// Validate prompt has a provider configured
	if (!prompt.provider) {
		new Notice(`Prompt "${prompt.name}" has no provider configured. Please configure a provider in settings.`);
		return;
	}

	// Validate prompt has text
	if (!prompt.promptText.trim()) {
		new Notice(`Prompt "${prompt.name}" has no prompt text. Please add prompt text in settings.`);
		return;
	}

	// Create the provider
	const provider = createPromptProvider(settings, prompt);
	if (!provider) {
		new Notice(`Could not find the configured provider for prompt "${prompt.name}". Please check your settings.`);
		return;
	}

	// Validate provider supports chat
	if (!provider.supportsChat()) {
		new Notice(`The provider for prompt "${prompt.name}" does not support chat. Please select a chat-capable model.`);
		return;
	}

	try {
		new Notice(`Executing prompt: ${prompt.name}...`);

		// Build chat messages with the prompt text as a user message
		const messages: ChatMessage[] = [
			{ role: 'user', content: prompt.promptText }
		];

		// Send the chat request
		const result = await provider.sendChat(messages);

		// Display the result in a modal
		const resultModal = new PromptResultModal(app, prompt.name, result.content);
		resultModal.open();

	} catch (error) {
		console.error('Prompt execution error:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		new Notice(`Failed to execute prompt: ${errorMessage}`);
	}
}

