import { App, PluginSettingTab, Setting } from "obsidian";
import AIToolboxPlugin from "../main";
import { SettingsTabType, ExpandOnNextRenderState } from "./types";
import { displayProvidersSettings, ProviderSettingsCallbacks } from "./providers";
import { displayWorkflowsSettings, WorkflowSettingsCallbacks } from "./workflows";
import { displayAdditionalSettings, AdditionalSettingsCallbacks } from "./additional-settings";

// Re-export all types and constants from types.ts
export {
	DEFAULT_OPENAI_ENDPOINT,
	generateId,
	DEFAULT_SETTINGS,
	DEFAULT_WORKFLOW_CONFIG,
	DEFAULT_CHAT_ACTION,
	DEFAULT_TRANSCRIPTION_ACTION
} from "./types";
export type {
	AIProviderType,
	AIModelConfig,
	AIProviderConfig,
	ProviderModelSelection,
	WorkflowConfig,
	WorkflowOutputType,
	WorkflowType,
	PromptSourceType,
	TranscriptionMediaType,
	TranscriptionSourceType,
	TranscriptionContextConfig,
	TimestampGranularity,
	ChatContextType,
	ChatContextConfig,
	ActionType,
	BaseAction,
	ChatAction,
	TranscriptionAction,
	WorkflowAction,
	AIToolboxSettings,
	SettingsTabType,
	ExpandOnNextRenderState
} from "./types";

export class AIToolboxSettingTab extends PluginSettingTab {
	plugin: AIToolboxPlugin;
	private activeTab: SettingsTabType = 'providers';
	// Track IDs that should start expanded on next render (cleared after use)
	private expandOnNextRender: ExpandOnNextRenderState = {};
	// Global advanced settings visibility state
	private showAdvancedSettings = false;

	constructor(app: App, plugin: AIToolboxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const tabContainer = containerEl.createDiv('settings-tab-container');

		// Global advanced settings toggle - positioned above tab header
		const advancedToggleSetting = new Setting(tabContainer)
			.addToggle(toggle => toggle
				.setValue(this.showAdvancedSettings)
				.onChange((value) => {
					this.showAdvancedSettings = value;
					advancedLabel.toggleClass('settings-advanced-toggle-label-active', value);
					this.display();
				}));
		advancedToggleSetting.settingEl.addClass('settings-advanced-toggle');
		const advancedLabel = advancedToggleSetting.controlEl.createSpan({
			text: 'Show advanced settings',
			cls: 'settings-advanced-toggle-label'
		});
		advancedToggleSetting.controlEl.prepend(advancedLabel);
		// Apply active state on initial render if already enabled
		if (this.showAdvancedSettings) {
			advancedLabel.addClass('settings-advanced-toggle-label-active');
		}

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

		const settingsTabButton = tabHeader.createEl('button', {
			text: 'Settings',
			cls: 'settings-tab-button'
		});

		const showTab = (tab: SettingsTabType) => {
			this.activeTab = tab;
			providersTabButton.classList.toggle('active', tab === 'providers');
			workflowsTabButton.classList.toggle('active', tab === 'workflows');
			settingsTabButton.classList.toggle('active', tab === 'settings');
			tabContent.empty();

			if (tab === 'providers') {
				this.displayProvidersTab(tabContent);
			} else if (tab === 'workflows') {
				this.displayWorkflowsTab(tabContent);
			} else if (tab === 'settings') {
				this.displaySettingsTab(tabContent);
			} else {
				const _exhaustiveCheck: never = tab;
				console.error(`Unknown settings tab: ${String(_exhaustiveCheck)}`);
			}
		};

		providersTabButton.addEventListener('click', () => showTab('providers'));
		workflowsTabButton.addEventListener('click', () => showTab('workflows'));
		settingsTabButton.addEventListener('click', () => showTab('settings'));

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
			refresh: () => this.display(),
			isAdvancedVisible: () => this.showAdvancedSettings
		};
		displayWorkflowsSettings(containerEl, this.plugin, callbacks);
	}

	private displaySettingsTab(containerEl: HTMLElement): void {
		const callbacks: AdditionalSettingsCallbacks = {
			refresh: () => this.display(),
			isAdvancedVisible: () => this.showAdvancedSettings
		};
		displayAdditionalSettings(containerEl, this.plugin, callbacks);
	}
}

