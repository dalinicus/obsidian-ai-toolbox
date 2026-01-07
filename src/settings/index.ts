import { App, PluginSettingTab } from "obsidian";
import AIToolboxPlugin from "../main";
import { SettingsTabType, ExpandOnNextRenderState } from "./types";
import { displayProvidersSettings, ProviderSettingsCallbacks } from "./providers";
import { displayWorkflowsSettings, WorkflowSettingsCallbacks } from "./workflows";
import { displayTranscriptionSettings, TranscriptionSettingsCallbacks } from "./transcription";

// Re-export all types and constants from types.ts for backward compatibility
export { DEFAULT_OPENAI_ENDPOINT, generateId, DEFAULT_SETTINGS, DEFAULT_WORKFLOW_CONFIG } from "./types";
export type {
	AIProviderType,
	AIModelConfig,
	AIProviderConfig,
	ProviderModelSelection,
	WorkflowConfig,
	WorkflowOutputType,
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

		const workflowsTabButton = tabHeader.createEl('button', {
			text: 'Workflows',
			cls: 'settings-tab-button'
		});

		const transcriptionTabButton = tabHeader.createEl('button', {
			text: 'Transcription',
			cls: 'settings-tab-button'
		});

		const showTab = (tab: SettingsTabType) => {
			this.activeTab = tab;
			providersTabButton.classList.toggle('active', tab === 'providers');
			workflowsTabButton.classList.toggle('active', tab === 'workflows');
			transcriptionTabButton.classList.toggle('active', tab === 'transcription');
			tabContent.empty();

			if (tab === 'providers') {
				this.displayProvidersTab(tabContent);
			} else if (tab === 'workflows') {
				this.displayWorkflowsTab(tabContent);
			} else if (tab === 'transcription') {
				this.displayTranscriptionTab(tabContent);
			} else {
				const _exhaustiveCheck: never = tab;
				console.error(`Unknown settings tab: ${String(_exhaustiveCheck)}`);
			}
		};

		providersTabButton.addEventListener('click', () => showTab('providers'));
		workflowsTabButton.addEventListener('click', () => showTab('workflows'));
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

	private displayWorkflowsTab(containerEl: HTMLElement): void {
		const callbacks: WorkflowSettingsCallbacks = {
			getExpandState: () => this.expandOnNextRender,
			setExpandState: (state) => { this.expandOnNextRender = state; },
			refresh: () => this.display()
		};
		displayWorkflowsSettings(containerEl, this.plugin, callbacks);
	}

	private displayTranscriptionTab(containerEl: HTMLElement): void {
		const callbacks: TranscriptionSettingsCallbacks = {
			refresh: () => this.display()
		};
		displayTranscriptionSettings(containerEl, this.plugin, callbacks);
	}
}

