import { App, PluginSettingTab } from "obsidian";
import AIToolboxPlugin from "../main";
import { SettingsTabType, ExpandOnNextRenderState } from "./types";
import { displayProvidersSettings, ProviderSettingsCallbacks } from "./providers";
import { displayPromptsSettings, PromptSettingsCallbacks } from "./prompts";
import { displayTranscriptionSettings, TranscriptionSettingsCallbacks } from "./transcription";

// Re-export all types and constants from types.ts for backward compatibility
export { DEFAULT_OPENAI_ENDPOINT, generateId, DEFAULT_SETTINGS } from "./types";
export type {
	AIProviderType,
	AIModelConfig,
	AIProviderConfig,
	ProviderModelSelection,
	PromptConfig,
	AIToolboxSettings,
	SettingsTabType,
	ExpandOnNextRenderState
} from "./types";

export class AIToolboxSettingTab extends PluginSettingTab {
	plugin: AIToolboxPlugin;
	private activeTab: SettingsTabType = 'providers';
	// Track IDs that should start expanded on next render (cleared after use)
	private expandOnNextRender: ExpandOnNextRenderState = {};

	constructor(app: App, plugin: AIToolboxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const tabContainer = containerEl.createDiv('settings-tab-container');
		const tabHeader = tabContainer.createDiv('settings-tab-header');
		const tabContent = tabContainer.createDiv('settings-tab-content');

		const providersTabButton = tabHeader.createEl('button', {
			text: 'Providers',
			cls: 'settings-tab-button'
		});

		const promptsTabButton = tabHeader.createEl('button', {
			text: 'Prompts',
			cls: 'settings-tab-button'
		});

		const transcriptionTabButton = tabHeader.createEl('button', {
			text: 'Transcription',
			cls: 'settings-tab-button'
		});

		const showTab = (tab: SettingsTabType) => {
			this.activeTab = tab;
			providersTabButton.classList.toggle('active', tab === 'providers');
			promptsTabButton.classList.toggle('active', tab === 'prompts');
			transcriptionTabButton.classList.toggle('active', tab === 'transcription');
			tabContent.empty();

			if (tab === 'providers') {
				this.displayProvidersTab(tabContent);
			} else if (tab === 'prompts') {
				this.displayPromptsTab(tabContent);
			} else if (tab === 'transcription') {
				this.displayTranscriptionTab(tabContent);
			} else {
				const _exhaustiveCheck: never = tab;
				console.error(`Unknown settings tab: ${String(_exhaustiveCheck)}`);
			}
		};

		providersTabButton.addEventListener('click', () => showTab('providers'));
		promptsTabButton.addEventListener('click', () => showTab('prompts'));
		transcriptionTabButton.addEventListener('click', () => showTab('transcription'));

		showTab(this.activeTab);
	}

	private displayProvidersTab(containerEl: HTMLElement): void {
		const callbacks: ProviderSettingsCallbacks = {
			getExpandState: () => this.expandOnNextRender,
			setExpandState: (state) => { this.expandOnNextRender = state; },
			refresh: () => this.display()
		};
		displayProvidersSettings(containerEl, this.plugin, callbacks);
	}

	private displayPromptsTab(containerEl: HTMLElement): void {
		const callbacks: PromptSettingsCallbacks = {
			getExpandState: () => this.expandOnNextRender,
			setExpandState: (state) => { this.expandOnNextRender = state; },
			refresh: () => this.display()
		};
		displayPromptsSettings(containerEl, this.plugin, callbacks);
	}

	private displayTranscriptionTab(containerEl: HTMLElement): void {
		const callbacks: TranscriptionSettingsCallbacks = {
			refresh: () => this.display()
		};
		displayTranscriptionSettings(containerEl, this.plugin, callbacks);
	}
}

