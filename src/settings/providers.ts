import { Setting, setIcon, ButtonComponent, Notice } from "obsidian";
import AIToolboxPlugin from "../main";
import {
	AIProviderConfig,
	AIProviderType,
	AIModelConfig,
	ExpandOnNextRenderState,
	generateId,
	DEFAULT_OPENAI_ENDPOINT
} from "./types";
import { createModelProvider, ModelProviderConfig } from "../providers";
import { createCollapsibleSection } from "../components/collapsible-section";
import { createTestAudioBuffer } from "../processing/audio-processor";
import { globalDeleteModeManager, nestedDeleteModeManager } from "../components/delete-mode-manager";
import { createEntityListHeader } from "../components/entity-list-header";
import { createMoveHandlers } from "../components/ordered-list-utils";

/**
 * Callbacks for the provider settings tab to communicate with the main settings tab
 */
export interface ProviderSettingsCallbacks {
	getExpandState: () => ExpandOnNextRenderState;
	setExpandState: (state: ExpandOnNextRenderState) => void;
	refresh: () => void;
}

/**
 * State for test button
 */
type TestButtonState = 'ready' | 'testing' | 'success' | 'error';

/**
 * Check if a model has all required configuration for testing
 */
function isModelConfigComplete(provider: AIProviderConfig, model: AIModelConfig): boolean {
	// Must have at least one capability enabled
	if (!model.supportsChat && !model.supportsTranscription) {
		return false;
	}

	// Must have API key
	if (!provider.apiKey) {
		return false;
	}

	// Must have model ID
	if (!model.modelId) {
		return false;
	}

	// Azure-specific requirements
	if (provider.type === 'azure-openai') {
		if (!provider.endpoint) {
			return false;
		}
		if (!model.deploymentName) {
			return false;
		}
	}

	return true;
}

/**
 * Build a ModelProviderConfig from provider and model settings
 */
function buildProviderConfig(provider: AIProviderConfig, model: AIModelConfig): ModelProviderConfig {
	const endpoint = provider.endpoint || (provider.type === 'openai' ? DEFAULT_OPENAI_ENDPOINT : '');
	return {
		id: provider.id,
		name: provider.name,
		modelDisplayName: model.name,
		type: provider.type,
		endpoint: endpoint,
		apiKey: provider.apiKey,
		modelId: model.modelId,
		deploymentName: model.deploymentName || model.modelId,
		supportsChat: model.supportsChat,
		supportsTranscription: model.supportsTranscription,
	};
}

/**
 * Test a model's chat capability
 */
async function testModelChat(provider: AIProviderConfig, model: AIModelConfig): Promise<{ success: boolean; error?: string }> {
	try {
		const config = buildProviderConfig(provider, model);
		const modelProvider = createModelProvider(config);

		// Send minimal test message
		await modelProvider.sendChat([
			{ role: 'user', content: 'Hello' }
		], {
			maxTokens: 10 // Keep it minimal to reduce cost
		});

		return { success: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { success: false, error: errorMessage };
	}
}

/**
 * Test a model's transcription capability
 */
async function testModelTranscription(provider: AIProviderConfig, model: AIModelConfig): Promise<{ success: boolean; error?: string }> {
	try {
		const config = buildProviderConfig(provider, model);
		const modelProvider = createModelProvider(config);

		// Create test audio and let the provider build form data with its fields
		const testAudio = createTestAudioBuffer();
		await modelProvider.transcribeAudioBuffer(testAudio);

		return { success: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { success: false, error: errorMessage };
	}
}

/**
 * Test a model based on its enabled capabilities
 */
async function testModel(provider: AIProviderConfig, model: AIModelConfig): Promise<{ success: boolean; error?: string }> {
	const results: Array<{ capability: string; success: boolean; error?: string }> = [];

	// Test chat if enabled
	if (model.supportsChat) {
		const chatResult = await testModelChat(provider, model);
		results.push({ capability: 'Chat', ...chatResult });
	}

	// Test transcription if enabled
	if (model.supportsTranscription) {
		const transcriptionResult = await testModelTranscription(provider, model);
		results.push({ capability: 'Transcription', ...transcriptionResult });
	}

	// Check if all tests passed
	const allPassed = results.every(r => r.success);

	if (allPassed) {
		return { success: true };
	} else {
		// Collect error messages
		const errors = results
			.filter(r => !r.success)
			.map(r => `${r.capability}: ${r.error}`)
			.join('; ');
		return { success: false, error: errors };
	}
}

// Key for provider-level delete mode in the global manager
const PROVIDERS_DELETE_MODE_KEY = '__providers__';

/**
 * Display the providers settings tab content
 */
export function displayProvidersSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	callbacks: ProviderSettingsCallbacks
): void {
	const isProviderDeleteMode = globalDeleteModeManager.get(PROVIDERS_DELETE_MODE_KEY);

	// Add provider header with delete mode toggle and add button
	createEntityListHeader({
		containerEl,
		label: 'AI providers',
		description: 'Configure AI providers for transcription and other features',
		isDeleteMode: isProviderDeleteMode,
		onDeleteModeChange: (value) => {
			globalDeleteModeManager.set(PROVIDERS_DELETE_MODE_KEY, value);
			callbacks.refresh();
		},
		addButtonText: 'Add provider',
		addButtonCta: true,
		onAdd: async () => {
			const newProvider: AIProviderConfig = {
				id: generateId(),
				name: 'New provider',
				type: 'azure-openai',
				endpoint: '',
				apiKey: '',
				models: []
			};
			plugin.settings.providers.push(newProvider);
			callbacks.setExpandState({ providerId: newProvider.id });
			await plugin.saveSettings();
			callbacks.refresh();
		}
	});

	// Add horizontal rule separator
	containerEl.createEl('hr', { cls: 'entity-list-separator' });

	// Display each provider
	for (let i = 0; i < plugin.settings.providers.length; i++) {
		const provider = plugin.settings.providers[i];
		if (!provider) continue;
		displayProviderSettings(containerEl, plugin, provider, i, callbacks, isProviderDeleteMode);
	}
}

function displayProviderSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	provider: AIProviderConfig,
	index: number,
	callbacks: ProviderSettingsCallbacks,
	isProviderDeleteMode: boolean
): void {
	const expandState = callbacks.getExpandState();
	const shouldExpand = expandState.providerId === provider.id;

	// Create move handlers using utility
	const moveHandlers = createMoveHandlers({
		items: plugin.settings.providers,
		index,
		isDeleteMode: isProviderDeleteMode,
		saveSettings: () => plugin.saveSettings(),
		preserveExpandState: () => callbacks.setExpandState({ providerId: provider.id }),
		refresh: callbacks.refresh
	});

	const { contentContainer, updateTitle, isExpanded } = createCollapsibleSection({
		containerEl,
		title: provider.name || 'Unnamed provider',
		containerClass: 'provider-container',
		contentClass: 'provider-content',
		headerClass: 'provider-header',
		startExpanded: shouldExpand,
		isHeading: true,
		onMoveUp: moveHandlers.onMoveUp,
		onMoveDown: moveHandlers.onMoveDown,
		// Show delete button only when in delete mode
		onDelete: isProviderDeleteMode ? async () => {
			plugin.settings.providers.splice(index, 1);
			await plugin.saveSettings();
			callbacks.refresh();
		} : undefined,
	});

	// Provider name
	new Setting(contentContainer)
		.setName('Name')
		.setDesc('Display name for this provider')
		.addText(text => text
			.setValue(provider.name)
			.onChange(async (value) => {
				provider.name = value;
				updateTitle(value || 'Unnamed provider');
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

	// Get model delete mode state for this provider from the nested manager
	const isModelDeleteMode = nestedDeleteModeManager.get(provider.id);

	// Models section header with delete mode toggle and add button
	createEntityListHeader({
		containerEl: contentContainer,
		label: 'Models',
		description: 'Configure available models for this provider',
		isDeleteMode: isModelDeleteMode,
		onDeleteModeChange: (value) => {
			nestedDeleteModeManager.set(provider.id, value);
			if (isExpanded()) {
				callbacks.setExpandState({ providerId: provider.id });
			}
			callbacks.refresh();
		},
		addButtonText: 'Add model',
		onAdd: async () => {
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
		}
	});

	// Display models
	for (let i = 0; i < provider.models.length; i++) {
		const model = provider.models[i];
		if (!model) continue;
		displayModelSettings(contentContainer, plugin, provider, model, i, callbacks, isExpanded, isModelDeleteMode);
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
	index: number,
	callbacks: ProviderSettingsCallbacks,
	isProviderExpanded: () => boolean,
	isModelDeleteMode: boolean
): void {
	const expandState = callbacks.getExpandState();
	const shouldExpand = expandState.modelId === model.id;

	// We need isModelExpanded before creating move handlers, so we track it via a ref
	let modelExpandedRef = { current: shouldExpand };

	// Helper to preserve model expand state on refresh
	const preserveModelExpandState = () => {
		if (isProviderExpanded() && modelExpandedRef.current) {
			callbacks.setExpandState({ providerId: provider.id, modelId: model.id });
		} else if (isProviderExpanded()) {
			callbacks.setExpandState({ providerId: provider.id });
		}
	};

	// Create move handlers using utility
	const moveHandlers = createMoveHandlers({
		items: provider.models,
		index,
		isDeleteMode: isModelDeleteMode,
		saveSettings: () => plugin.saveSettings(),
		preserveExpandState: preserveModelExpandState,
		refresh: callbacks.refresh
	});

	const { contentContainer, updateTitle, isExpanded: isModelExpanded } = createCollapsibleSection({
		containerEl,
		title: model.name || 'Unnamed model',
		containerClass: 'model-container',
		contentClass: 'model-content',
		headerClass: 'model-header',
		startExpanded: shouldExpand,
		isHeading: false,
		onMoveUp: moveHandlers.onMoveUp,
		onMoveDown: moveHandlers.onMoveDown,
		// Show delete button only when in delete mode
		onDelete: isModelDeleteMode ? async () => {
			provider.models.splice(index, 1);
			await plugin.saveSettings();
			if (isProviderExpanded()) {
				callbacks.setExpandState({ providerId: provider.id });
			}
			callbacks.refresh();
		} : undefined,
	});

	// Update the ref to use the actual isExpanded function
	modelExpandedRef = { get current() { return isModelExpanded(); } };

	// Model name
	new Setting(contentContainer)
		.setName('Display name')
		.addText(text => text
			.setPlaceholder('Whisper')
			.setValue(model.name)
			.onChange(async (value) => {
				model.name = value;
				updateTitle(value || 'Unnamed model');
				await plugin.saveSettings();
			}));

	// Test button - declare early so it can be referenced in field change handlers
	let testButton: ButtonComponent | null = null;
	let testButtonState: TestButtonState = 'ready';

	const updateTestButton = () => {
		if (testButton === null) return;

		const isConfigComplete = isModelConfigComplete(provider, model);
		testButton.setDisabled(!isConfigComplete || testButtonState === 'testing');

		// Update tooltip based on enabled capabilities
		const capabilities: string[] = [];
		if (model.supportsChat) capabilities.push('chat');
		if (model.supportsTranscription) capabilities.push('transcription');
		const capabilityText = capabilities.length > 0
			? capabilities.join(' and ')
			: 'model';
		testButton.setTooltip(`Test ${capabilityText} capability`);

		// Update button text and class based on state
		switch (testButtonState) {
			case 'ready':
				testButton.setButtonText('Test');
				testButton.buttonEl.removeClass('mod-warning', 'mod-success');
				break;
			case 'testing':
				testButton.setButtonText('Testing...');
				testButton.buttonEl.removeClass('mod-warning', 'mod-success');
				break;
			case 'success':
				testButton.setButtonText('✓ passed');
				testButton.buttonEl.removeClass('mod-warning');
				testButton.buttonEl.addClass('mod-success');
				break;
			case 'error':
				testButton.setButtonText('✗ error');
				testButton.buttonEl.removeClass('mod-success');
				testButton.buttonEl.addClass('mod-warning');
				break;
		}
	};

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
					updateTestButton();
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
				updateTestButton();
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
				// Update test button state when capability changes
				updateTestButton();
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
				// Update test button state when capability changes
				updateTestButton();
			}));
	const transcriptionNameEl = transcriptionSetting.nameEl;
	const transcriptionIcon = transcriptionNameEl.createSpan({ cls: 'model-capability-icon' });
	setIcon(transcriptionIcon, 'audio-lines');
	transcriptionNameEl.appendText(' Transcription');

	// Test button (inline with capabilities)
	new Setting(capabilitiesContainer)
		.addButton(button => {
			testButton = button;

			button.onClick(async () => {
				// Reset to testing state
				testButtonState = 'testing';
				updateTestButton();

				// Run the test
				const result = await testModel(provider, model);

				// Update state based on result
				if (result.success) {
					testButtonState = 'success';
					new Notice('✓ test passed');
				} else {
					testButtonState = 'error';
					// Show error as Notice and log to console
					new Notice(`✗ test failed: ${result.error}`, 5000);
					console.error('Model test failed:', result.error);
				}
				updateTestButton();

				// Reset to ready state after 3 seconds
				setTimeout(() => {
					testButtonState = 'ready';
					updateTestButton();
				}, 3000);
			});

			// Initial state
			updateTestButton();
		});
}

