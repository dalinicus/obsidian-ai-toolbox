import { Setting } from "obsidian";
import AIToolboxPlugin from "../main";
import {
	WorkflowConfig,
	WorkflowOutputType,
	WorkflowAction,
	ChatAction,
	TranscriptionAction,
	ActionType,
	PromptSourceType,
	TranscriptionMediaType,
	TimestampGranularity,
	ExpandOnNextRenderState,
	generateId,
	DEFAULT_WORKFLOW_CONFIG,
	DEFAULT_CHAT_ACTION,
	DEFAULT_TRANSCRIPTION_ACTION
} from "./types";
import { createCollapsibleSection } from "../components/collapsible-section";
import { createPathPicker } from "../components/path-picker";
import {
	getAvailableTokensForAction,
	TokenGroup,
	TokenDefinition,
	generateGroupTemplate
} from "../tokens";
import { setIcon, Notice } from "obsidian";

/**
 * Callbacks for the workflows settings tab to communicate with the main settings tab
 */
export interface WorkflowSettingsCallbacks {
	getExpandState: () => ExpandOnNextRenderState;
	setExpandState: (state: ExpandOnNextRenderState) => void;
	refresh: () => void;
	isAdvancedVisible: () => boolean;
}

/**
 * Output type display labels
 */
const OUTPUT_TYPE_OPTIONS: Record<WorkflowOutputType, string> = {
	'popup': 'Show in popup',
	'new-note': 'Create new note',
	'at-cursor': 'Insert at cursor'
};

/**
 * Prompt source type display labels
 */
const PROMPT_SOURCE_OPTIONS: Record<PromptSourceType, string> = {
	'inline': 'Inline',
	'from-file': 'From file'
};

/**
 * Display the workflows settings tab content
 */
export function displayWorkflowsSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	callbacks: WorkflowSettingsCallbacks
): void {
	// Add workflow button
	new Setting(containerEl)
		.setName('Workflows')
		.setDesc('Configure custom workflows with actions')
		.addButton(button => button
			.setButtonText('Add workflow')
			.setCta()
			.onClick(async () => {
				const newWorkflow: WorkflowConfig = {
					id: generateId(),
					...DEFAULT_WORKFLOW_CONFIG,
					actions: []  // Create new array to avoid shared reference
				};
				plugin.settings.workflows.push(newWorkflow);
				callbacks.setExpandState({ workflowId: newWorkflow.id });
				await plugin.saveSettings();
				callbacks.refresh();
			}));

	// Display each workflow
	for (const workflow of plugin.settings.workflows) {
		displayWorkflowSettings(containerEl, plugin, workflow, callbacks);
	}
}

function displayWorkflowSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	workflow: WorkflowConfig,
	callbacks: WorkflowSettingsCallbacks
): void {
	const expandState = callbacks.getExpandState();
	const shouldExpand = expandState.workflowId === workflow.id;

	// Ensure actions array exists (for backward compatibility with old workflows)
	if (!workflow.actions) {
		workflow.actions = [];
	}

	// Determine icon based on first action type (or default)
	const firstAction = workflow.actions[0];
	const icon = firstAction?.type === 'transcription' ? 'audio-lines' : 'message-circle';

	const showAdvanced = callbacks.isAdvancedVisible();

	const { contentContainer, updateTitle, isExpanded } = createCollapsibleSection({
		containerEl,
		title: workflow.name || 'Unnamed workflow',
		containerClass: 'workflow-container',
		contentClass: 'workflow-content',
		headerClass: 'workflow-header',
		startExpanded: shouldExpand,
		isHeading: true,
		icon,
		secondaryText: showAdvanced ? workflow.id : undefined,
		onDelete: async () => {
			const index = plugin.settings.workflows.findIndex(w => w.id === workflow.id);
			if (index !== -1) {
				plugin.settings.workflows.splice(index, 1);
				await plugin.saveSettings();
				callbacks.refresh();
			}
		},
	});

	// Workflow name
	new Setting(contentContainer)
		.setName('Name')
		.setDesc('Display name for this workflow')
		.addText(text => text
			.setValue(workflow.name)
			.onChange(async (value) => {
				workflow.name = value;
				updateTitle(value || 'Unnamed workflow');
				await plugin.saveSettings();
			}));

	// Actions section
	displayActionsSection(contentContainer, plugin, workflow, callbacks, isExpanded);

	// Output type
	new Setting(contentContainer)
		.setName('Output type')
		.setDesc('How to display the workflow result')
		.addDropdown(dropdown => dropdown
			.addOptions(OUTPUT_TYPE_OPTIONS)
			.setValue(workflow.outputType)
			.onChange(async (value) => {
				workflow.outputType = value as WorkflowOutputType;
				await plugin.saveSettings();
				if (isExpanded()) {
					callbacks.setExpandState({ workflowId: workflow.id });
				}
				callbacks.refresh();
			}));

	// Output folder (only for new-note output type)
	if (workflow.outputType === 'new-note') {
		createPathPicker({
			containerEl: contentContainer,
			app: plugin.app,
			name: 'Output folder',
			description: 'Folder where new notes will be created',
			initialPath: workflow.outputFolder ?? '',
			allowFiles: false,
			onChange: (path: string) => {
				workflow.outputFolder = path;
				void plugin.saveSettings();
			}
		});
	}

	// Clear the expand state after rendering this workflow
	if (expandState.workflowId === workflow.id) {
		callbacks.setExpandState({});
	}
}

/**
 * Action type display labels
 */
const ACTION_TYPE_OPTIONS: Record<ActionType, string> = {
	'chat': 'Chat',
	'transcription': 'Transcription'
};

/**
 * Display the actions section for a workflow
 */
function displayActionsSection(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	workflow: WorkflowConfig,
	callbacks: WorkflowSettingsCallbacks,
	isExpanded: () => boolean
): void {
	const actionsContainer = containerEl.createDiv('actions-section');
	actionsContainer.createDiv({ text: 'Actions', cls: 'actions-section-title' });

	// Add action button
	new Setting(actionsContainer)
		.addDropdown(dropdown => dropdown
			.addOption('', 'Add action...')
			.addOptions(ACTION_TYPE_OPTIONS)
			.onChange(async (value) => {
				if (!value) return;

				const actionType = value as ActionType;
				let newAction: WorkflowAction;

				if (actionType === 'chat') {
					newAction = {
						...DEFAULT_CHAT_ACTION,
						id: generateId(),
						name: `Chat ${workflow.actions.length + 1}`,
						contexts: []  // Create new array to avoid shared reference
					};
				} else {
					newAction = {
						...DEFAULT_TRANSCRIPTION_ACTION,
						id: generateId(),
						name: `Transcription ${workflow.actions.length + 1}`,
						// Create new object to avoid shared reference
						transcriptionContext: { mediaType: 'video', sourceUrlToken: 'workflow.clipboard' }
					};
				}

				workflow.actions.push(newAction);
				await plugin.saveSettings();

				if (isExpanded()) {
					callbacks.setExpandState({ workflowId: workflow.id });
				}
				callbacks.refresh();
			}));

	// Display each action
	for (let i = 0; i < workflow.actions.length; i++) {
		const action = workflow.actions[i];
		if (!action) continue;
		displayActionSettings(actionsContainer, plugin, workflow, action, i, callbacks, isExpanded);
	}
}

/**
 * Display settings for a single action
 */
function displayActionSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	workflow: WorkflowConfig,
	action: WorkflowAction,
	index: number,
	callbacks: WorkflowSettingsCallbacks,
	isExpanded: () => boolean
): void {
	const actionIcon = action.type === 'transcription' ? 'audio-lines' : 'message-circle';
	const expandState = callbacks.getExpandState();
	const shouldExpandAction = expandState.workflowId === workflow.id && expandState.actionId === action.id;

	const { contentContainer, updateTitle, isExpanded: isActionExpanded } = createCollapsibleSection({
		containerEl,
		title: action.name || `Action ${index + 1}`,
		containerClass: 'action-container',
		contentClass: 'action-content',
		headerClass: 'action-header',
		startExpanded: shouldExpandAction,
		isHeading: false,
		icon: actionIcon,
		onDelete: async () => {
			workflow.actions.splice(index, 1);
			await plugin.saveSettings();
			if (isExpanded()) {
				callbacks.setExpandState({ workflowId: workflow.id });
			}
			callbacks.refresh();
		},
	});

	// Helper to preserve action expand state on refresh
	const preserveActionExpandState = () => {
		if (isExpanded() && isActionExpanded()) {
			callbacks.setExpandState({ workflowId: workflow.id, actionId: action.id });
		} else if (isExpanded()) {
			callbacks.setExpandState({ workflowId: workflow.id });
		}
	};

	// Clear the action expand state after applying it
	if (shouldExpandAction) {
		callbacks.setExpandState({ workflowId: workflow.id });
	}

	// Action name
	new Setting(contentContainer)
		.setName('Name')
		.setDesc('Display name for this action')
		.addText(text => text
			.setValue(action.name)
			.onChange(async (value) => {
				action.name = value;
				updateTitle(value || `Action ${index + 1}`);
				await plugin.saveSettings();
			}));

	// Available tokens section (for chat actions only, since they use prompts)
	if (action.type === 'chat') {
		displayAvailableTokensSection(contentContainer, workflow, index, plugin);
	}

	// Route to type-specific settings
	if (action.type === 'transcription') {
		displayTranscriptionActionSettings(contentContainer, plugin, action, callbacks, workflow, preserveActionExpandState);
	} else {
		displayChatActionSettings(contentContainer, plugin, action, callbacks, preserveActionExpandState);
	}
}

/**
 * Display the available tokens section for an action
 */
function displayAvailableTokensSection(
	containerEl: HTMLElement,
	workflow: WorkflowConfig,
	actionIndex: number,
	_plugin: AIToolboxPlugin
): void {
	const tokenGroups = getAvailableTokensForAction(workflow, actionIndex);

	// Create collapsible section
	const { contentContainer } = createCollapsibleSection({
		containerEl,
		title: 'Available Tokens',
		containerClass: 'available-tokens-section',
		contentClass: 'available-tokens-content',
		headerClass: 'available-tokens-header',
		startExpanded: false,
		isHeading: false
	});

	// Display each token group
	for (const group of tokenGroups) {
		displayTokenGroup(contentContainer, group);
	}
}

/**
 * Copy text to clipboard and show a notification
 */
async function copyToClipboard(text: string, description: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		new Notice(`Copied ${description} to clipboard`);
	} catch {
		new Notice('Failed to copy to clipboard');
	}
}

/**
 * Display a group of tokens
 */
function displayTokenGroup(containerEl: HTMLElement, group: TokenGroup): void {
	const groupEl = containerEl.createDiv('available-tokens-group');

	// Group header with copy functionality
	const headerEl = groupEl.createDiv({ cls: 'available-tokens-group-header is-clickable' });
	headerEl.createSpan({ text: group.name });

	const copyIconEl = headerEl.createSpan({ cls: 'available-tokens-copy-icon' });
	setIcon(copyIconEl, 'copy');

	headerEl.addEventListener('click', () => {
		const template = generateGroupTemplate(group);
		void copyToClipboard(template, group.name);
	});
	headerEl.setAttribute('aria-label', `Copy all ${group.name} tokens`);

	displayTokenList(groupEl, group.tokens);
}

/**
 * Display a list of tokens with click-to-copy functionality
 */
function displayTokenList(containerEl: HTMLElement, tokens: TokenDefinition[]): void {
	const tokenListEl = containerEl.createEl('ul', { cls: 'available-tokens-list' });

	for (const token of tokens) {
		const tokenEl = tokenListEl.createEl('li', { cls: 'available-tokens-item' });

		const tokenNameEl = tokenEl.createSpan({ cls: 'available-tokens-reference' });
		tokenNameEl.textContent = `{{${token.name}}}`;
		tokenNameEl.setAttribute('aria-label', 'Click to copy');
		tokenNameEl.addEventListener('click', (e) => {
			e.stopPropagation();
			void copyToClipboard(`{{${token.name}}}`, 'token');
		});

		tokenEl.appendText(' ');

		const tokenDescEl = tokenEl.createSpan({ cls: 'available-tokens-description' });
		tokenDescEl.textContent = `— ${token.description}`;
	}
}

/**
 * Display chat action settings
 */
function displayChatActionSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	action: ChatAction,
	callbacks: WorkflowSettingsCallbacks,
	preserveActionExpandState: () => void
): void {
	// Provider selection
	displayActionProviderSelection(containerEl, plugin, action, 'chat');

	// Prompt source type dropdown
	const promptSourceType = action.promptSourceType ?? 'inline';
	new Setting(containerEl)
		.setName('Prompt source')
		.setDesc('Choose where the prompt text comes from')
		.addDropdown(dropdown => dropdown
			.addOptions(PROMPT_SOURCE_OPTIONS)
			.setValue(promptSourceType)
			.onChange(async (value) => {
				action.promptSourceType = value as PromptSourceType;
				await plugin.saveSettings();
				preserveActionExpandState();
				callbacks.refresh();
			}));

	// Prompt text textarea (only show when source is inline)
	if (promptSourceType === 'inline') {
		new Setting(containerEl)
			.setName('Prompt text')
			.setDesc('The prompt text to send to the AI model')
			.addTextArea(textArea => {
				textArea
					.setPlaceholder('Enter your prompt text here...')
					.setValue(action.promptText ?? '')
					.onChange(async (value) => {
						action.promptText = value;
						await plugin.saveSettings();
					});
				textArea.inputEl.rows = 6;
				textArea.inputEl.addClass('workflow-textarea');
			});
	}

	// Prompt file picker (only show when source is from-file)
	if (promptSourceType === 'from-file') {
		createPathPicker({
			containerEl,
			app: plugin.app,
			name: 'Prompt file',
			description: 'Search for a file to use as the prompt template',
			placeholder: 'Search for file...',
			initialPath: action.promptFilePath ?? '',
			allowFiles: true,
			onChange: (path: string) => {
				action.promptFilePath = path;
				void plugin.saveSettings();
			}
		});
	}
}

/**
 * Display transcription action settings
 */
function displayTranscriptionActionSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	action: TranscriptionAction,
	callbacks: WorkflowSettingsCallbacks,
	workflow: WorkflowConfig,
	preserveActionExpandState: () => void
): void {
	// Provider selection
	displayActionProviderSelection(containerEl, plugin, action, 'transcription');

	// Ensure transcriptionContext exists
	if (!action.transcriptionContext) {
		action.transcriptionContext = { mediaType: 'video', sourceUrlToken: 'workflow.clipboard' };
	}

	// Media type dropdown
	const mediaTypeOptions: Record<TranscriptionMediaType, string> = {
		'video': 'Video',
		'audio': 'Audio'
	};
	new Setting(containerEl)
		.setName('Media type')
		.setDesc('The type of media to transcribe')
		.addDropdown(dropdown => dropdown
			.addOptions(mediaTypeOptions)
			.setValue(action.transcriptionContext?.mediaType ?? 'video')
			.onChange(async (value) => {
				if (!action.transcriptionContext) {
					action.transcriptionContext = { mediaType: 'video', sourceUrlToken: 'workflow.clipboard' };
				}
				action.transcriptionContext.mediaType = value as TranscriptionMediaType;
				await plugin.saveSettings();
			}));

	// Source URL token picker
	const actionIndex = workflow.actions.findIndex(a => a.id === action.id);
	const tokenGroups = getAvailableTokensForAction(workflow, actionIndex);

	// Build dropdown options from available tokens
	const tokenOptions: Record<string, string> = {};
	for (const group of tokenGroups) {
		for (const token of group.tokens) {
			tokenOptions[token.name] = token.name;
		}
	}

	new Setting(containerEl)
		.setName('Source URL')
		.setDesc('Select a token containing the video/audio URL')
		.addDropdown(dropdown => dropdown
			.addOptions(tokenOptions)
			.setValue(action.transcriptionContext?.sourceUrlToken ?? 'workflow.clipboard')
			.onChange(async (value) => {
				if (!action.transcriptionContext) {
					action.transcriptionContext = { mediaType: 'video', sourceUrlToken: 'workflow.clipboard' };
				}
				action.transcriptionContext.sourceUrlToken = value;
				await plugin.saveSettings();
			}));

	// Language setting (advanced)
	const showAdvanced = callbacks.isAdvancedVisible();
	const languageSetting = new Setting(containerEl)
		.setName('Language')
		.setDesc('Optional language code for transcription (e.g., "en", "es", "fr"). Leave empty for auto-detection.')
		.addText(text => text
			.setPlaceholder('Auto-detect')
			.setValue(action.language ?? '')
			.onChange(async (value) => {
				action.language = value;
				await plugin.saveSettings();
			}));
	languageSetting.settingEl.toggleClass('settings-advanced-hidden', !showAdvanced);
	if (showAdvanced) {
		languageSetting.nameEl.addClass('settings-advanced-name');
	}

	// Timestamp granularity dropdown (advanced)
	const granularityOptions: Record<TimestampGranularity, string> = {
		'disabled': 'Disabled (no timestamps)',
		'segment': 'Segment (sentence/phrase level)',
		'word': 'Word (individual word level)'
	};
	const granularitySetting = new Setting(containerEl)
		.setName('Timestamp granularity')
		.setDesc('Level of detail for timestamps. Disabling reduces token usage.')
		.addDropdown(dropdown => dropdown
			.addOptions(granularityOptions)
			.setValue(action.timestampGranularity ?? 'disabled')
			.onChange(async (value) => {
				action.timestampGranularity = value as TimestampGranularity;
				await plugin.saveSettings();
				preserveActionExpandState();
				callbacks.refresh();
			}));
	granularitySetting.settingEl.toggleClass('settings-advanced-hidden', !showAdvanced);
	if (showAdvanced) {
		granularitySetting.nameEl.addClass('settings-advanced-name');
	}
}

/**
 * Display provider selection for an action
 */
function displayActionProviderSelection(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	action: WorkflowAction,
	capability: 'chat' | 'transcription'
): void {
	const providers = plugin.settings.providers;
	const currentSelection = action.provider;

	// Build options for provider/model dropdown
	const options: Record<string, string> = { '': 'Select a provider and model' };
	for (const provider of providers) {
		for (const model of provider.models) {
			const supportsCapability = capability === 'chat' ? model.supportsChat : model.supportsTranscription;
			if (supportsCapability) {
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
		.setDesc(`Select the provider and model to use for ${capability}`)
		.addDropdown(dropdown => dropdown
			.addOptions(options)
			.setValue(currentValue)
			.onChange(async (value) => {
				if (value === '') {
					action.provider = null;
				} else {
					const parts = value.split(':');
					if (parts.length === 2 && parts[0] && parts[1]) {
						action.provider = {
							providerId: parts[0],
							modelId: parts[1]
						};
					}
				}
				await plugin.saveSettings();
			}));
}
