import { Setting, setIcon } from "obsidian";
import AIToolboxPlugin from "../main";
import {
	AIProviderConfig,
	AIProviderType,
	AIModelConfig,
	ExpandOnNextRenderState,
	generateId
} from "./types";

/**
 * Callbacks for the provider settings tab to communicate with the main settings tab
 */
export interface ProviderSettingsCallbacks {
	getExpandState: () => ExpandOnNextRenderState;
	setExpandState: (state: ExpandOnNextRenderState) => void;
	refresh: () => void;
}

/**
 * Display the providers settings tab content
 */
export function displayProvidersSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	callbacks: ProviderSettingsCallbacks
): void {
	// Add provider button
	new Setting(containerEl)
		.setName('AI providers')
		.setDesc('Configure AI providers for transcription and other features')
		.addButton(button => button
			.setButtonText('Add provider')
			.setCta()
			.onClick(async () => {
				const newProvider: AIProviderConfig = {
					id: generateId(),
					name: 'New provider',
					type: 'azure-openai',
					endpoint: '',
					apiKey: '',
					models: []
				};
				plugin.settings.providers.push(newProvider);
				await plugin.saveSettings();
				callbacks.refresh();
			}));

	// Display each provider
	for (const provider of plugin.settings.providers) {
		displayProviderSettings(containerEl, plugin, provider, callbacks);
	}
}

function displayProviderSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	provider: AIProviderConfig,
	callbacks: ProviderSettingsCallbacks
): void {
	const providerContainer = containerEl.createDiv('provider-container');
	const expandState = callbacks.getExpandState();

	// Check if this provider should be expanded (has a newly added model)
	const shouldExpand = expandState.providerId === provider.id;

	// Collapsible content container
	const contentContainer = providerContainer.createDiv(`provider-content ${shouldExpand ? 'is-expanded' : 'is-collapsed'}`);

	// Provider header with collapse toggle, name and delete button
	const headerSetting = new Setting(providerContainer)
		.setName(`${shouldExpand ? '▾' : '▸'} ${provider.name || 'Unnamed provider'}`)
		.setHeading()
		.addButton(button => button
			.setIcon('trash')
			.setTooltip('Delete provider')
			.onClick(async () => {
				const index = plugin.settings.providers.findIndex(p => p.id === provider.id);
				if (index !== -1) {
					plugin.settings.providers.splice(index, 1);
					// Clear transcription provider if it was using this provider
					if (plugin.settings.transcriptionProvider?.providerId === provider.id) {
						plugin.settings.transcriptionProvider = null;
					}
					await plugin.saveSettings();
					callbacks.refresh();
				}
			}));

	headerSetting.settingEl.addClass('provider-header');

	const toggleCollapse = () => {
		const isCollapsed = contentContainer.classList.contains('is-collapsed');
		contentContainer.classList.toggle('is-collapsed', !isCollapsed);
		contentContainer.classList.toggle('is-expanded', isCollapsed);
		headerSetting.setName(`${isCollapsed ? '▾' : '▸'} ${provider.name || 'Unnamed provider'}`);
	};

	headerSetting.settingEl.addEventListener('click', (e) => {
		// Don't toggle if clicking on the delete button
		if (!(e.target as HTMLElement).closest('button')) {
			toggleCollapse();
		}
	});

	// Move content container after header
	providerContainer.appendChild(contentContainer);

	// Provider name
	new Setting(contentContainer)
		.setName('Name')
		.setDesc('Display name for this provider')
		.addText(text => text
			.setValue(provider.name)
			.onChange(async (value) => {
				provider.name = value;
				const isExpanded = contentContainer.classList.contains('is-expanded');
				headerSetting.setName(`${isExpanded ? '▾' : '▸'} ${value || 'Unnamed provider'}`);
				await plugin.saveSettings();
			}));

	// Provider type
	new Setting(contentContainer)
		.setName('Type')
		.setDesc('AI provider type')
		.addDropdown(dropdown => dropdown
			.addOption('openai', 'OpenAI') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.addOption('azure-openai', 'Azure OpenAI') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.setValue(provider.type)
			.onChange(async (value) => {
				provider.type = value as AIProviderType;
				// Keep provider expanded after type change
				callbacks.setExpandState({ providerId: provider.id });
				await plugin.saveSettings();
				callbacks.refresh();
			}));

	// API Key
	new Setting(contentContainer)
		.setName('API key')
		.setDesc('Your API key for this provider')
		.addText(text => {
			text.inputEl.type = 'password';
			text.setPlaceholder('Enter your API key')
				.setValue(provider.apiKey)
				.onChange(async (value) => {
					provider.apiKey = value;
					await plugin.saveSettings();
				});
		});

	// Endpoint (optional for OpenAI)
	const isOpenAI = provider.type === 'openai';
	const endpointDesc = provider.type === 'azure-openai'
		? 'Your Azure OpenAI resource endpoint (e.g., https://your-resource.openai.azure.com)'
		: isOpenAI
			? 'API endpoint URL (optional, defaults to https://api.openai.com/v1)'
			: 'API endpoint URL';
	new Setting(contentContainer)
		.setName(isOpenAI ? 'Endpoint (optional)' : 'Endpoint')
		.setDesc(endpointDesc)
		.addText(text => text
			.setPlaceholder(provider.type === 'azure-openai' ? 'https://your-resource.openai.azure.com' : 'https://api.openai.com/v1')
			.setValue(provider.endpoint)
			.onChange(async (value) => {
				provider.endpoint = value;
				await plugin.saveSettings();
			}));

	// Models section
	new Setting(contentContainer)
		.setName('Models')
		.setDesc('Configure available models for this provider')
		.addButton(button => button
			.setButtonText('Add model')
			.onClick(async () => {
				const newModel: AIModelConfig = {
					id: generateId(),
					name: 'New model',
					deploymentName: '',
					modelId: ''
				};
				provider.models.push(newModel);
				// Keep provider expanded and expand the new model
				callbacks.setExpandState({ providerId: provider.id, modelId: newModel.id });
				await plugin.saveSettings();
				callbacks.refresh();
			}));

	// Display models
	for (const model of provider.models) {
		displayModelSettings(contentContainer, plugin, provider, model, callbacks);
	}

	// Clear the expand state after rendering all models for this provider
	if (expandState.providerId === provider.id) {
		callbacks.setExpandState({});
	}
}

function displayModelSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	provider: AIProviderConfig,
	model: AIModelConfig,
	callbacks: ProviderSettingsCallbacks
): void {
	const modelContainer = containerEl.createDiv('model-container');
	const expandState = callbacks.getExpandState();

	// Check if this model should be expanded (newly added)
	const shouldExpand = expandState.modelId === model.id;

	// Collapsible content container
	const contentContainer = modelContainer.createDiv(`model-content ${shouldExpand ? 'is-expanded' : 'is-collapsed'}`);

	const modelDisplayName = model.name || 'Unnamed model';

	// Model header with collapse toggle and delete button
	const headerSetting = new Setting(modelContainer)
		.setName(`${shouldExpand ? '▾' : '▸'} ${modelDisplayName}`)
		.addButton(button => button
			.setIcon('trash')
			.setTooltip('Delete model')
			.onClick(async () => {
				const index = provider.models.findIndex(m => m.id === model.id);
				if (index !== -1) {
					provider.models.splice(index, 1);
					// Clear transcription provider if it was using this model
					if (plugin.settings.transcriptionProvider?.modelId === model.id) {
						plugin.settings.transcriptionProvider = null;
					}
					// Keep provider expanded after deletion
					callbacks.setExpandState({ providerId: provider.id });
					await plugin.saveSettings();
					callbacks.refresh();
				}
			}));

	headerSetting.settingEl.addClass('model-header');

	const toggleCollapse = () => {
		const isCollapsed = contentContainer.classList.contains('is-collapsed');
		contentContainer.classList.toggle('is-collapsed', !isCollapsed);
		contentContainer.classList.toggle('is-expanded', isCollapsed);
		headerSetting.setName(`${isCollapsed ? '▾' : '▸'} ${model.name || 'Unnamed model'}`);
	};

	headerSetting.settingEl.addEventListener('click', (e) => {
		// Don't toggle if clicking on the delete button
		if (!(e.target as HTMLElement).closest('button')) {
			toggleCollapse();
		}
	});

	// Move content container after header
	modelContainer.appendChild(contentContainer);

	// Model name
	new Setting(contentContainer)
		.setName('Display name')
		.addText(text => text
			.setPlaceholder('Whisper')
			.setValue(model.name)
			.onChange(async (value) => {
				model.name = value;
				const isCollapsed = contentContainer.classList.contains('is-collapsed');
				headerSetting.setName(`${isCollapsed ? '▸' : '▾'} ${value || 'Unnamed model'}`);
				await plugin.saveSettings();
			}));

	// Deployment name (for Azure)
	if (provider.type === 'azure-openai') {
		new Setting(contentContainer)
			.setName('Deployment name')
			.setDesc('The deployment name in Azure OpenAI') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.addText(text => text
				.setPlaceholder('whisper-1') // eslint-disable-line obsidianmd/ui/sentence-case -- model identifier
				.setValue(model.deploymentName)
				.onChange(async (value) => {
					model.deploymentName = value;
					await plugin.saveSettings();
				}));
	}

	// Model ID
	new Setting(contentContainer)
		.setName('Model ID')
		.setDesc('The model identifier')
		.addText(text => text
			.setPlaceholder('whisper-1') // eslint-disable-line obsidianmd/ui/sentence-case -- model identifier
			.setValue(model.modelId)
			.onChange(async (value) => {
				model.modelId = value;
				await plugin.saveSettings();
			}));

	// Model capabilities section
	const capabilitiesContainer = contentContainer.createDiv('model-capabilities');

	// Chat capability toggle
	const chatSetting = new Setting(capabilitiesContainer)
		.addToggle(toggle => toggle
			.setValue(model.supportsChat ?? false)
			.onChange(async (value) => {
				model.supportsChat = value;
				await plugin.saveSettings();
			}));
	const chatNameEl = chatSetting.nameEl;
	const chatIcon = chatNameEl.createSpan({ cls: 'model-capability-icon' });
	setIcon(chatIcon, 'message-circle');
	chatNameEl.appendText(' Chat');

	// Transcription capability toggle
	const transcriptionSetting = new Setting(capabilitiesContainer)
		.addToggle(toggle => toggle
			.setValue(model.supportsTranscription ?? false)
			.onChange(async (value) => {
				model.supportsTranscription = value;
				await plugin.saveSettings();
			}));
	const transcriptionNameEl = transcriptionSetting.nameEl;
	const transcriptionIcon = transcriptionNameEl.createSpan({ cls: 'model-capability-icon' });
	setIcon(transcriptionIcon, 'audio-lines');
	transcriptionNameEl.appendText(' Transcription');
}

