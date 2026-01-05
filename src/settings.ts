import {App, PluginSettingTab, Setting} from "obsidian";
import AIToolboxPlugin from "./main";

export interface AIToolboxSettings {
	impersonateBrowser: string;
	ytdlpLocation: string;
	ffmpegLocation: string;
	outputDirectory: string;
	keepVideo: boolean;
	azureEndpoint: string;
	azureApiKey: string;
	azureDeploymentName: string;
	includeTimestamps: boolean;
	transcriptionLanguage: string;
	outputFolder: string;
}

export const DEFAULT_SETTINGS: AIToolboxSettings = {
	impersonateBrowser: 'chrome',
	ytdlpLocation: '',
	ffmpegLocation: '',
	outputDirectory: '',
	keepVideo: false,
	azureEndpoint: '',
	azureApiKey: '',
	azureDeploymentName: '',
	includeTimestamps: true,
	transcriptionLanguage: '',
	outputFolder: ''
}

export class AIToolboxSettingTab extends PluginSettingTab {
	plugin: AIToolboxPlugin;
	private activeTab: 'transcription' | 'ai' = 'ai';

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

		const aiTabButton = tabHeader.createEl('button', {
			text: 'AI settings',
			cls: 'settings-tab-button'
		});

		const transcriptionTabButton = tabHeader.createEl('button', {
			text: 'Transcription',
			cls: 'settings-tab-button'
		});

		const showTab = (tab: 'transcription' | 'ai') => {
			this.activeTab = tab;
			aiTabButton.classList.toggle('active', tab === 'ai');
			transcriptionTabButton.classList.toggle('active', tab === 'transcription');
			tabContent.empty();

			if (tab === 'ai') {
				this.displayAISettings(tabContent);
			} else if (tab === 'transcription') {
				this.displayTranscriptionSettings(tabContent);
			} else {
				const _exhaustiveCheck: never = tab;
				console.error(`Unknown settings tab: ${String(_exhaustiveCheck)}`);
			}
		};

		aiTabButton.addEventListener('click', () => showTab('ai'));
		transcriptionTabButton.addEventListener('click', () => showTab('transcription'));

		showTab(this.activeTab);
	}

	private displayAISettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Azure OpenAI') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.setHeading();

		new Setting(containerEl)
			.setName('Endpoint')
			.setDesc('Your Azure OpenAI resource endpoint (e.g., https://your-resource.openai.azure.com)')
			.addText(text => text
				.setPlaceholder('https://your-resource.openai.azure.com')
				.setValue(this.plugin.settings.azureEndpoint)
				.onChange(async (value) => {
					this.plugin.settings.azureEndpoint = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API key')
			.setDesc('Your Azure OpenAI API key') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.addText(text => {
				text.inputEl.type = 'password';
				text.setPlaceholder('Enter your API key')
					.setValue(this.plugin.settings.azureApiKey)
					.onChange(async (value) => {
						this.plugin.settings.azureApiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Whisper deployment name')
			.setDesc('The name of your Whisper model deployment in Azure OpenAI') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.addText(text => text
				.setPlaceholder('Enter your deployment name')
				.setValue(this.plugin.settings.azureDeploymentName)
				.onChange(async (value) => {
					this.plugin.settings.azureDeploymentName = value;
					await this.plugin.saveSettings();
				}));
	}

	private displayTranscriptionSettings(containerEl: HTMLElement): void {
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
