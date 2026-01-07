import { Setting } from "obsidian";
import AIToolboxPlugin from "../main";
import {
	PromptConfig,
	ExpandOnNextRenderState,
	generateId
} from "./types";

/**
 * Callbacks for the prompts settings tab to communicate with the main settings tab
 */
export interface PromptSettingsCallbacks {
	getExpandState: () => ExpandOnNextRenderState;
	setExpandState: (state: ExpandOnNextRenderState) => void;
	refresh: () => void;
}

/**
 * Display the prompts settings tab content
 */
export function displayPromptsSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	callbacks: PromptSettingsCallbacks
): void {
	// Add prompt button
	new Setting(containerEl)
		.setName('Custom prompts')
		.setDesc('Configure custom prompts to use with your AI providers')
		.addButton(button => button
			.setButtonText('Add prompt')
			.setCta()
			.onClick(async () => {
				const newPrompt: PromptConfig = {
					id: generateId(),
					name: 'New prompt',
					promptText: '',
					provider: null
				};
				plugin.settings.prompts.push(newPrompt);
				// Expand the newly created prompt
				callbacks.setExpandState({ promptId: newPrompt.id });
				await plugin.saveSettings();
				callbacks.refresh();
			}));

	// Display each prompt
	for (const prompt of plugin.settings.prompts) {
		displayPromptSettings(containerEl, plugin, prompt, callbacks);
	}
}

function displayPromptSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	prompt: PromptConfig,
	callbacks: PromptSettingsCallbacks
): void {
	const promptContainer = containerEl.createDiv('prompt-container');
	const expandState = callbacks.getExpandState();

	// Check if this prompt should be expanded (newly added)
	const shouldExpand = expandState.promptId === prompt.id;

	// Collapsible content container
	const contentContainer = promptContainer.createDiv(`prompt-content ${shouldExpand ? 'is-expanded' : 'is-collapsed'}`);

	// Prompt header with collapse toggle, name and delete button
	const headerSetting = new Setting(promptContainer)
		.setName(`${shouldExpand ? '▾' : '▸'} ${prompt.name || 'Unnamed prompt'}`)
		.setHeading()
		.addButton(button => button
			.setIcon('trash')
			.setTooltip('Delete prompt')
			.onClick(async () => {
				const index = plugin.settings.prompts.findIndex(p => p.id === prompt.id);
				if (index !== -1) {
					plugin.settings.prompts.splice(index, 1);
					await plugin.saveSettings();
					callbacks.refresh();
				}
			}));

	headerSetting.settingEl.addClass('prompt-header');

	const toggleCollapse = () => {
		const isCollapsed = contentContainer.classList.contains('is-collapsed');
		contentContainer.classList.toggle('is-collapsed', !isCollapsed);
		contentContainer.classList.toggle('is-expanded', isCollapsed);
		headerSetting.setName(`${isCollapsed ? '▾' : '▸'} ${prompt.name || 'Unnamed prompt'}`);
	};

	headerSetting.settingEl.addEventListener('click', (e) => {
		// Don't toggle if clicking on the delete button
		if (!(e.target as HTMLElement).closest('button')) {
			toggleCollapse();
		}
	});

	// Move content container after header
	promptContainer.appendChild(contentContainer);

	// Prompt name
	new Setting(contentContainer)
		.setName('Name')
		.setDesc('Display name for this prompt')
		.addText(text => text
			.setValue(prompt.name)
			.onChange(async (value) => {
				prompt.name = value;
				const isExpanded = contentContainer.classList.contains('is-expanded');
				headerSetting.setName(`${isExpanded ? '▾' : '▸'} ${value || 'Unnamed prompt'}`);
				await plugin.saveSettings();
			}));

	// Provider/Model selection (only models that support chat)
	displayPromptProviderSelection(contentContainer, plugin, prompt);

	// Prompt text
	new Setting(contentContainer)
		.setName('Prompt text')
		.setDesc('The prompt text to send to the AI model')
		.addTextArea(textArea => {
			textArea
				.setPlaceholder('Enter your prompt text here...')
				.setValue(prompt.promptText)
				.onChange(async (value) => {
					prompt.promptText = value;
					await plugin.saveSettings();
				});
			textArea.inputEl.rows = 6;
			textArea.inputEl.addClass('prompt-textarea');
		});

	// Clear the expand state after rendering this prompt
	if (expandState.promptId === prompt.id) {
		callbacks.setExpandState({});
	}
}

function displayPromptProviderSelection(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	prompt: PromptConfig
): void {
	const providers = plugin.settings.providers;
	const currentSelection = prompt.provider;

	// Build options for provider/model dropdown (only models that support chat)
	const options: Record<string, string> = { '': 'Select a provider and model' };
	for (const provider of providers) {
		for (const model of provider.models) {
			if (model.supportsChat) {
				const key = `${provider.id}:${model.id}`;
				options[key] = `${provider.name} - ${model.name}`;
			}
		}
	}

	const currentValue = currentSelection
		? `${currentSelection.providerId}:${currentSelection.modelId}`
		: '';

	new Setting(containerEl)
		.setName('Provider')
		.setDesc('Select the provider and model to use for this prompt')
		.addDropdown(dropdown => dropdown
			.addOptions(options)
			.setValue(currentValue)
			.onChange(async (value) => {
				if (value === '') {
					prompt.provider = null;
				} else {
					const parts = value.split(':');
					if (parts.length === 2 && parts[0] && parts[1]) {
						prompt.provider = {
							providerId: parts[0],
							modelId: parts[1]
						};
					}
				}
				await plugin.saveSettings();
			}));
}

