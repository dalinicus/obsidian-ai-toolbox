import {App, PluginSettingTab, Setting, setIcon} from "obsidian";
import AIToolboxPlugin from "./main";

/**
 * Default OpenAI API endpoint
 */
export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1';

/**
 * Supported AI provider types
 */
export type AIProviderType = 'azure-openai' | 'openai' | 'anthropic';

/**
 * Model configuration for a provider
 */
export interface AIModelConfig {
	id: string;
	name: string;
	deploymentName: string; // Used by Azure, can be same as model ID for other providers
	modelId: string;
	supportsChat?: boolean; // Whether this model supports chat/conversation
	supportsTranscription?: boolean; // Whether this model supports audio transcription
}

/**
 * AI Provider configuration
 */
export interface AIProviderConfig {
	id: string;
	name: string;
	type: AIProviderType;
	endpoint: string;
	apiKey: string;
	models: AIModelConfig[];
}

/**
 * Reference to a specific provider and model for a feature
 */
export interface ProviderModelSelection {
	providerId: string;
	modelId: string;
}

export interface AIToolboxSettings {
	impersonateBrowser: string;
	ytdlpLocation: string;
	ffmpegLocation: string;
	outputDirectory: string;
	keepVideo: boolean;
	includeTimestamps: boolean;
	transcriptionLanguage: string;
	outputFolder: string;
	// New provider-based settings
	providers: AIProviderConfig[];
	transcriptionProvider: ProviderModelSelection | null;
}

/**
 * Generate a unique ID for providers and models
 */
export function generateId(): string {
	return Math.random().toString(36).substring(2, 11);
}

export const DEFAULT_SETTINGS: AIToolboxSettings = {
	impersonateBrowser: 'chrome',
	ytdlpLocation: '',
	ffmpegLocation: '',
	outputDirectory: '',
	keepVideo: false,
	includeTimestamps: true,
	transcriptionLanguage: '',
	outputFolder: '',
	providers: [],
	transcriptionProvider: null
}

export class AIToolboxSettingTab extends PluginSettingTab {
	plugin: AIToolboxPlugin;
	private activeTab: 'transcription' | 'providers' = 'providers';
	// Track IDs that should start expanded on next render (cleared after use)
	private expandOnNextRender: { providerId?: string; modelId?: string } = {};

	constructor(app: App, plugin: AIToolboxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		const tabContainer = containerEl.createDiv('settings-tab-container');
		const tabHeader = tabContainer.createDiv('settings-tab-header');
		const tabContent = tabContainer.createDiv('settings-tab-content');

		const providersTabButton = tabHeader.createEl('button', {
			text: 'Providers',
			cls: 'settings-tab-button'
		});

		const transcriptionTabButton = tabHeader.createEl('button', {
			text: 'Transcription',
			cls: 'settings-tab-button'
		});

		const showTab = (tab: 'transcription' | 'providers') => {
			this.activeTab = tab;
			providersTabButton.classList.toggle('active', tab === 'providers');
			transcriptionTabButton.classList.toggle('active', tab === 'transcription');
			tabContent.empty();

			if (tab === 'providers') {
				this.displayProvidersSettings(tabContent);
			} else if (tab === 'transcription') {
				this.displayTranscriptionSettings(tabContent);
			} else {
				const _exhaustiveCheck: never = tab;
				console.error(`Unknown settings tab: ${String(_exhaustiveCheck)}`);
			}
		};

		providersTabButton.addEventListener('click', () => showTab('providers'));
		transcriptionTabButton.addEventListener('click', () => showTab('transcription'));

		showTab(this.activeTab);
	}

	private displayProvidersSettings(containerEl: HTMLElement): void {
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
					this.plugin.settings.providers.push(newProvider);
					await this.plugin.saveSettings();
					this.display();
				}));

		// Display each provider
		for (const provider of this.plugin.settings.providers) {
			this.displayProviderSettings(containerEl, provider);
		}
	}

	private displayProviderSettings(containerEl: HTMLElement, provider: AIProviderConfig): void {
		const providerContainer = containerEl.createDiv('provider-container');

		// Check if this provider should be expanded (has a newly added model)
		const shouldExpand = this.expandOnNextRender.providerId === provider.id;

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
					const index = this.plugin.settings.providers.findIndex(p => p.id === provider.id);
					if (index !== -1) {
						this.plugin.settings.providers.splice(index, 1);
						// Clear transcription provider if it was using this provider
						if (this.plugin.settings.transcriptionProvider?.providerId === provider.id) {
							this.plugin.settings.transcriptionProvider = null;
						}
						await this.plugin.saveSettings();
						this.display();
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
					await this.plugin.saveSettings();
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
					this.expandOnNextRender = { providerId: provider.id };
					await this.plugin.saveSettings();
					this.display();
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
						await this.plugin.saveSettings();
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
					await this.plugin.saveSettings();
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
					this.expandOnNextRender = { providerId: provider.id, modelId: newModel.id };
					await this.plugin.saveSettings();
					this.display();
				}));

		// Display models
		for (const model of provider.models) {
			this.displayModelSettings(contentContainer, provider, model);
		}

		// Clear the expand state after rendering all models for this provider
		if (this.expandOnNextRender.providerId === provider.id) {
			this.expandOnNextRender = {};
		}
	}

	private displayModelSettings(containerEl: HTMLElement, provider: AIProviderConfig, model: AIModelConfig): void {
		const modelContainer = containerEl.createDiv('model-container');

		// Check if this model should be expanded (newly added)
		const shouldExpand = this.expandOnNextRender.modelId === model.id;

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
						if (this.plugin.settings.transcriptionProvider?.modelId === model.id) {
							this.plugin.settings.transcriptionProvider = null;
						}
						// Keep provider expanded after deletion
						this.expandOnNextRender = { providerId: provider.id };
						await this.plugin.saveSettings();
						this.display();
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
					await this.plugin.saveSettings();
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
						await this.plugin.saveSettings();
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
					await this.plugin.saveSettings();
				}));

		// Model capabilities section
		const capabilitiesContainer = contentContainer.createDiv('model-capabilities');

		// Chat capability toggle
		const chatSetting = new Setting(capabilitiesContainer)
			.addToggle(toggle => toggle
				.setValue(model.supportsChat ?? false)
				.onChange(async (value) => {
					model.supportsChat = value;
					await this.plugin.saveSettings();
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
					await this.plugin.saveSettings();
				}));
		const transcriptionNameEl = transcriptionSetting.nameEl;
		const transcriptionIcon = transcriptionNameEl.createSpan({ cls: 'model-capability-icon' });
		setIcon(transcriptionIcon, 'audio-lines');
		transcriptionNameEl.appendText(' Transcription');
	}

	private displayTranscriptionProviderSelection(containerEl: HTMLElement): void {
		const providers = this.plugin.settings.providers;
		const currentSelection = this.plugin.settings.transcriptionProvider;

		// Build options for provider/model dropdown (only models that support transcription)
		const options: Record<string, string> = { '': 'Select a provider and model' };
		for (const provider of providers) {
			for (const model of provider.models) {
				if (model.supportsTranscription) {
					const key = `${provider.id}:${model.id}`;
					options[key] = `${provider.name} - ${model.name}`;
				}
			}
		}

		const currentValue = currentSelection
			? `${currentSelection.providerId}:${currentSelection.modelId}`
			: '';

		new Setting(containerEl)
			.setName('Transcription provider')
			.setDesc('Select the provider and model to use for audio transcription')
			.addDropdown(dropdown => dropdown
				.addOptions(options)
				.setValue(currentValue)
				.onChange(async (value) => {
					if (value === '') {
						this.plugin.settings.transcriptionProvider = null;
					} else {
						const parts = value.split(':');
						if (parts.length === 2 && parts[0] && parts[1]) {
							this.plugin.settings.transcriptionProvider = {
								providerId: parts[0],
								modelId: parts[1]
							};
						}
					}
					await this.plugin.saveSettings();
				}));
	}

	private displayTranscriptionSettings(containerEl: HTMLElement): void {
		// Transcription provider selection at the top
		this.displayTranscriptionProviderSelection(containerEl);

		new Setting(containerEl)
			.setName('Browser to impersonate')
			.setDesc('Browser to impersonate when extracting audio for transcription')
			.addDropdown(dropdown => dropdown
				.addOption('chrome', 'Chrome')
				.addOption('edge', 'Edge')
				.addOption('safari', 'Safari')
				.addOption('firefox', 'Firefox')
				.addOption('brave', 'Brave')
				.addOption('chromium', 'Chromium')
				.setValue(this.plugin.settings.impersonateBrowser)
				.onChange(async (value) => {
					this.plugin.settings.impersonateBrowser = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Language')
			.setDesc('Language code for transcription (e.g., en, es, fr). Leave empty for automatic detection')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.transcriptionLanguage)
				.onChange(async (value) => {
					this.plugin.settings.transcriptionLanguage = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Include timestamps')
			.setDesc('Include timestamps in transcription notes for each chunk of text')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeTimestamps)
				.onChange(async (value) => {
					this.plugin.settings.includeTimestamps = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Notes folder')
			.setDesc('Folder where transcription notes will be created (leave empty for vault root)')
			.addText(text => text
				.setValue(this.plugin.settings.outputFolder)
				.onChange(async (value) => {
					this.plugin.settings.outputFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Keep video file')
			.setDesc('Keep the original video file after extracting audio for transcription')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.keepVideo)
				.onChange(async (value) => {
					this.plugin.settings.keepVideo = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.keepVideo) {
			new Setting(containerEl)
				.setName('Output directory')
				.setDesc('Directory where video files will be saved (leave empty to use ~/Videos/Obsidian)') // eslint-disable-line obsidianmd/ui/sentence-case -- path example
				.addText(text => text
					.setPlaceholder('~/Videos/Obsidian') // eslint-disable-line obsidianmd/ui/sentence-case -- path example
					.setValue(this.plugin.settings.outputDirectory)
					.onChange(async (value) => {
						this.plugin.settings.outputDirectory = value;
						await this.plugin.saveSettings();
					}));
		}

		const advancedContainer = containerEl.createDiv('settings-advanced-container is-collapsed');

		const advancedSetting = new Setting(containerEl)
			.setName('▸ Advanced') // eslint-disable-line obsidianmd/ui/sentence-case
			.setHeading();

		advancedSetting.settingEl.addClass('settings-advanced-heading');

		const toggleAdvanced = () => {
			const isCollapsed = advancedContainer.classList.contains('is-collapsed');
			advancedContainer.classList.toggle('is-collapsed', !isCollapsed);
			advancedContainer.classList.toggle('is-expanded', isCollapsed);
			advancedSetting.setName(`${isCollapsed ? '▾' : '▸'} Advanced`);
		};

		advancedSetting.settingEl.addEventListener('click', toggleAdvanced);

		// Move the advancedContainer after the heading
		containerEl.appendChild(advancedContainer);

		new Setting(advancedContainer)
			.setName('yt-dlp path') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.setDesc('Path to yt-dlp binary directory (leave empty to use system PATH)') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.addText(text => text
				.setValue(this.plugin.settings.ytdlpLocation)
				.onChange(async (value) => {
					this.plugin.settings.ytdlpLocation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(advancedContainer)
			.setName('FFmpeg path') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.setDesc('Path to FFmpeg binary directory (leave empty to use system PATH)') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.addText(text => text
				.setValue(this.plugin.settings.ffmpegLocation)
				.onChange(async (value) => {
					this.plugin.settings.ffmpegLocation = value;
					await this.plugin.saveSettings();
				}));

	}
}
