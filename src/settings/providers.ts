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
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
 * Generate a minimal valid WAV file with audio content
 * Creates a 1-second WAV file at 16kHz mono with a simple tone pattern
 */
function generateTestAudioFile(): Buffer {
	const sampleRate = 16000;
	const duration = 1; // 1 second
	const numSamples = sampleRate * duration;
	const numChannels = 1;
	const bitsPerSample = 16;
	const bytesPerSample = bitsPerSample / 8;
	const blockAlign = numChannels * bytesPerSample;
	const byteRate = sampleRate * blockAlign;
	const dataSize = numSamples * blockAlign;
	const fileSize = 36 + dataSize;

	const buffer = Buffer.alloc(44 + dataSize);
	let offset = 0;

	// RIFF header
	buffer.write('RIFF', offset); offset += 4;
	buffer.writeUInt32LE(fileSize, offset); offset += 4;
	buffer.write('WAVE', offset); offset += 4;

	// fmt chunk
	buffer.write('fmt ', offset); offset += 4;
	buffer.writeUInt32LE(16, offset); offset += 4; // fmt chunk size
	buffer.writeUInt16LE(1, offset); offset += 2; // audio format (1 = PCM)
	buffer.writeUInt16LE(numChannels, offset); offset += 2;
	buffer.writeUInt32LE(sampleRate, offset); offset += 4;
	buffer.writeUInt32LE(byteRate, offset); offset += 4;
	buffer.writeUInt16LE(blockAlign, offset); offset += 2;
	buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

	// data chunk
	buffer.write('data', offset); offset += 4;
	buffer.writeUInt32LE(dataSize, offset); offset += 4;

	// Generate audio data - simple pattern that sounds like speech
	// Using multiple frequencies to create a more natural sound
	for (let i = 0; i < numSamples; i++) {
		const t = i / sampleRate;
		// Mix of frequencies to simulate speech-like sound
		const freq1 = 200 + Math.sin(t * 10) * 50; // Varying fundamental frequency
		const freq2 = 800 + Math.sin(t * 15) * 100; // First formant
		const freq3 = 2400; // Second formant

		// Envelope to create word-like pattern
		const envelope = Math.sin(t * Math.PI) * 0.3;

		const sample = envelope * (
			Math.sin(2 * Math.PI * freq1 * t) * 0.5 +
			Math.sin(2 * Math.PI * freq2 * t) * 0.3 +
			Math.sin(2 * Math.PI * freq3 * t) * 0.2
		);

		const value = Math.floor(sample * 32767);
		buffer.writeInt16LE(value, offset);
		offset += 2;
	}

	return buffer;
}

/**
 * Get a temporary test audio file path with the embedded test audio
 */
function getTestAudioFile(): string {
	const tempDir = os.tmpdir();
	const testAudioPath = path.join(tempDir, 'obsidian-ai-toolbox-test.wav');

	// Always regenerate the test audio file to ensure it's valid
	const audioBuffer = generateTestAudioFile();
	fs.writeFileSync(testAudioPath, audioBuffer);

	return testAudioPath;
}

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

		// Get test audio file
		const testAudioPath = getTestAudioFile();

		// Transcribe the test audio
		await modelProvider.transcribeAudio(testAudioPath, {
			includeTimestamps: false
		});

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

	// Test button - declare early so it can be referenced in field change handlers
	let testButton: ButtonComponent;
	let testButtonState: TestButtonState = 'ready';

	const updateTestButton = () => {
		if (!testButton) return;

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
				testButton.setButtonText('✓ Success');
				testButton.buttonEl.removeClass('mod-warning');
				testButton.buttonEl.addClass('mod-success');
				break;
			case 'error':
				testButton.setButtonText('✗ Failed');
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
					new Notice('✓ Model test successful');
				} else {
					testButtonState = 'error';
					// Show error as Notice and log to console
					new Notice(`✗ Model test failed: ${result.error}`, 5000);
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

