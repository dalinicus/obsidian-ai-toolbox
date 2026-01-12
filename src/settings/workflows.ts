import { Notice, setIcon, Setting } from "obsidian";
import AIToolboxPlugin from "../main";
import {
	WorkflowConfig,
	WorkflowOutputType,
	WorkflowType,
	PromptSourceType,
	TranscriptionMediaType,
	TranscriptionSourceType,
	TimestampGranularity,
	ChatContextType,
	ExpandOnNextRenderState,
	generateId,
	DEFAULT_WORKFLOW_CONFIG
} from "./types";
import { createCollapsibleSection } from "../components/collapsible-section";
import { createPathPicker } from "../components/path-picker";
import { WorkflowTypeModal } from "../components/workflow-type-modal";
import { TokenDefinition, getWorkflowContextTokens, generateWorkflowTokenTemplate } from "../tokens";
import {
	CHAT_CONTEXT_TYPE_LABELS,
	CHAT_CONTEXT_TYPE_DESCRIPTIONS,
	createContextHandler,
	getAvailableContextTypes
} from "../handlers";

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
		.setDesc('Configure custom workflows to use with your AI providers')
		.addButton(button => button
			.setButtonText('Add workflow')
			.setCta()
			.onClick(() => {
				// Show modal to select workflow type
				const modal = new WorkflowTypeModal(plugin.app, (type: WorkflowType) => {
					const newWorkflow: WorkflowConfig = {
						id: generateId(),
						...DEFAULT_WORKFLOW_CONFIG,
						type
					};
					plugin.settings.workflows.push(newWorkflow);
					// Expand the newly created workflow
					callbacks.setExpandState({ workflowId: newWorkflow.id });
					void plugin.saveSettings().then(() => callbacks.refresh());
				});
				modal.open();
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

	// Determine icon based on workflow type (default to 'chat' for backward compatibility)
	const workflowType = workflow.type || 'chat';
	const icon = workflowType === 'chat' ? 'message-circle' : 'audio-lines';

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

	// Workflow name (common to all workflow types)
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

	// Route to type-specific settings
	if (workflowType === 'transcription') {
		displayTranscriptionWorkflowSettings(contentContainer, plugin, workflow, callbacks, isExpanded);
	} else {
		// Default to chat workflow settings for backward compatibility
		displayChatWorkflowSettings(contentContainer, plugin, workflow, callbacks, isExpanded);
	}

	// Clear the expand state after rendering this workflow
	if (expandState.workflowId === workflow.id) {
		callbacks.setExpandState({});
	}
}

/**
 * Display chat-specific workflow settings
 */
function displayChatWorkflowSettings(
	contentContainer: HTMLElement,
	plugin: AIToolboxPlugin,
	workflow: WorkflowConfig,
	callbacks: WorkflowSettingsCallbacks,
	isExpanded: () => boolean
): void {
	// Provider/Model selection (only models that support chat)
	displayWorkflowProviderSelection(contentContainer, plugin, workflow);

	// Context section
	displayContextSection(contentContainer, plugin, workflow, callbacks, isExpanded);

	// Prompt source type dropdown
	const promptSourceType = workflow.promptSourceType ?? 'inline';
	new Setting(contentContainer)
		.setName('Prompt source')
		.setDesc('Choose where the prompt text comes from')
		.addDropdown(dropdown => dropdown
			.addOptions(PROMPT_SOURCE_OPTIONS)
			.setValue(promptSourceType)
			.onChange(async (value) => {
				workflow.promptSourceType = value as PromptSourceType;
				await plugin.saveSettings();
				// Preserve expand state when refreshing
				if (isExpanded()) {
					callbacks.setExpandState({ workflowId: workflow.id });
				}
				callbacks.refresh();
			}));

	// Prompt text textarea (only show when source is inline)
	if (promptSourceType === 'inline') {
		new Setting(contentContainer)
			.setName('Prompt text')
			.setDesc('The prompt text to send to the AI model')
			.addTextArea(textArea => {
				textArea
					.setPlaceholder('Enter your prompt text here...')
					.setValue(workflow.promptText)
					.onChange(async (value) => {
						workflow.promptText = value;
						await plugin.saveSettings();
					});
				textArea.inputEl.rows = 6;
				textArea.inputEl.addClass('workflow-textarea');
			});
	}

	// Prompt file picker (only show when source is from-file)
	if (promptSourceType === 'from-file') {
		createPathPicker({
			containerEl: contentContainer,
			app: plugin.app,
			name: 'Prompt file',
			description: 'Search for a file to use as the prompt template',
			placeholder: 'Search for file...',
			initialPath: workflow.promptFilePath ?? '',
			allowFiles: true,
			onChange: async (path: string) => {
				workflow.promptFilePath = path;
				await plugin.saveSettings();
			}
		});
	}

	// Make available as input to other workflows toggle
	new Setting(contentContainer)
		.setName('Make available as input to other workflows')
		.setDesc('Allow this workflow to be used as input context for other workflows')
		.addToggle(toggle => toggle
			.setValue(workflow.availableAsInput ?? false)
			.onChange(async (value) => {
				workflow.availableAsInput = value;
				await plugin.saveSettings();
				// Refresh so other workflow dropdowns update to include/exclude this workflow
				if (isExpanded()) {
					callbacks.setExpandState({ workflowId: workflow.id });
				}
				callbacks.refresh();
			}));

	// List in Workflow Command toggle
	new Setting(contentContainer)
		.setName('List in run workflow command')
		.setDesc('Show this workflow in the list when running the run workflow command')
		.addToggle(toggle => toggle
			.setValue(workflow.showInCommand ?? true)
			.onChange(async (value) => {
				workflow.showInCommand = value;
				await plugin.saveSettings();
				// Preserve expand state when refreshing
				if (isExpanded()) {
					callbacks.setExpandState({ workflowId: workflow.id });
				}
				callbacks.refresh();
			}));

	// Output type selection (only show if workflow is listed in command)
	if (workflow.showInCommand ?? true) {
		new Setting(contentContainer)
			.setName('Output type')
			.setDesc('Choose how to display the AI response')
			.addDropdown(dropdown => dropdown
				.addOptions(OUTPUT_TYPE_OPTIONS)
				.setValue(workflow.outputType || 'popup')
				.onChange(async (value) => {
					workflow.outputType = value as WorkflowOutputType;
					await plugin.saveSettings();
					// Preserve expand state when refreshing (output folder visibility may change)
					if (isExpanded()) {
						callbacks.setExpandState({ workflowId: workflow.id });
					}
					callbacks.refresh();
				}));

		// Output folder (only show if output type is new-note)
		if (workflow.outputType === 'new-note') {
			createPathPicker({
				containerEl: contentContainer,
				app: plugin.app,
				name: 'Output folder',
				description: 'Folder where notes will be created (leave empty to use default)',
				placeholder: 'Search for folder...',
				initialPath: workflow.outputFolder || '',
				onChange: async (path: string) => {
					workflow.outputFolder = path;
					await plugin.saveSettings();
				}
			});
		}
	}
}

function displayWorkflowProviderSelection(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	workflow: WorkflowConfig
): void {
	const providers = plugin.settings.providers;
	const currentSelection = workflow.provider;

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
		.setDesc('Select the provider and model to use for this workflow')
		.addDropdown(dropdown => dropdown
			.addOptions(options)
			.setValue(currentValue)
			.onChange(async (value) => {
				if (value === '') {
					workflow.provider = null;
				} else {
					const parts = value.split(':');
					if (parts.length === 2 && parts[0] && parts[1]) {
						workflow.provider = {
							providerId: parts[0],
							modelId: parts[1]
						};
					}
				}
				await plugin.saveSettings();
			}));
}

/**
 * Display provider selection for transcription workflows
 * Only shows models that support transcription
 */
function displayTranscriptionProviderSelection(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	workflow: WorkflowConfig
): void {
	const providers = plugin.settings.providers;
	const currentSelection = workflow.provider;

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
		.setName('Provider')
		.setDesc('Select the provider and model to use for transcription')
		.addDropdown(dropdown => dropdown
			.addOptions(options)
			.setValue(currentValue)
			.onChange(async (value) => {
				if (value === '') {
					workflow.provider = null;
				} else {
					const parts = value.split(':');
					if (parts.length === 2 && parts[0] && parts[1]) {
						workflow.provider = {
							providerId: parts[0],
							modelId: parts[1]
						};
					}
				}
				await plugin.saveSettings();
			}));
}

/**
 * Display transcription-specific workflow settings
 */
function displayTranscriptionWorkflowSettings(
	contentContainer: HTMLElement,
	plugin: AIToolboxPlugin,
	workflow: WorkflowConfig,
	callbacks: WorkflowSettingsCallbacks,
	isExpanded: () => boolean
): void {
	// Provider selection (only models that support transcription)
	displayTranscriptionProviderSelection(contentContainer, plugin, workflow);

	// Media type dropdown
	const mediaTypeOptions: Record<TranscriptionMediaType, string> = {
		'video': 'Video',
		'audio': 'Audio'
	};
	new Setting(contentContainer)
		.setName('Media type')
		.setDesc('The type of media to transcribe')
		.addDropdown(dropdown => dropdown
			.addOptions(mediaTypeOptions)
			.setValue(workflow.transcriptionContext?.mediaType ?? 'video')
			.onChange(async (value) => {
				if (!workflow.transcriptionContext) {
					workflow.transcriptionContext = { mediaType: 'video', sourceType: 'url-from-clipboard' };
				}
				workflow.transcriptionContext.mediaType = value as TranscriptionMediaType;
				await plugin.saveSettings();
			}));

	// Source type dropdown
	const sourceTypeOptions: Record<TranscriptionSourceType, string> = {
		'select-file-from-vault': 'Select file from vault',
		'url-from-clipboard': 'URL from clipboard',
		'url-from-selection': 'URL from selection'
	};
	new Setting(contentContainer)
		.setName('Source')
		.setDesc('Where to get the media file from')
		.addDropdown(dropdown => dropdown
			.addOptions(sourceTypeOptions)
			.setValue(workflow.transcriptionContext?.sourceType ?? 'url-from-clipboard')
			.onChange(async (value) => {
				if (!workflow.transcriptionContext) {
					workflow.transcriptionContext = { mediaType: 'video', sourceType: 'url-from-clipboard' };
				}
				workflow.transcriptionContext.sourceType = value as TranscriptionSourceType;
				await plugin.saveSettings();
			}));

	// Language setting (advanced)
	const showAdvanced = callbacks.isAdvancedVisible();
	const languageSetting = new Setting(contentContainer)
		.setName('Language')
		.setDesc('Optional language code for transcription (e.g., "en", "es", "fr"). Leave empty for auto-detection.')
		.addText(text => text
			.setPlaceholder('Auto-detect')
			.setValue(workflow.language || '')
			.onChange(async (value) => {
				workflow.language = value;
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
	const granularitySetting = new Setting(contentContainer)
		.setName('Timestamp granularity')
		.setDesc('Level of detail for timestamps. Disabling reduces token usage.')
		.addDropdown(dropdown => dropdown
			.addOptions(granularityOptions)
			.setValue(workflow.timestampGranularity ?? 'disabled')
			.onChange(async (value) => {
				workflow.timestampGranularity = value as TimestampGranularity;
				await plugin.saveSettings();
				callbacks.setExpandState({ workflowId: workflow.id });
				callbacks.refresh();
			}));
	granularitySetting.settingEl.toggleClass('settings-advanced-hidden', !showAdvanced);
	if (showAdvanced) {
		granularitySetting.nameEl.addClass('settings-advanced-name');
	}

	// Make available as input to other workflows toggle
	new Setting(contentContainer)
		.setName('Make available as input to other workflows')
		.setDesc('Allow this workflow to be used as input context for other workflows')
		.addToggle(toggle => toggle
			.setValue(workflow.availableAsInput ?? false)
			.onChange(async (value) => {
				workflow.availableAsInput = value;
				await plugin.saveSettings();
				// Refresh so other workflow dropdowns update to include/exclude this workflow
				if (isExpanded()) {
					callbacks.setExpandState({ workflowId: workflow.id });
				}
				callbacks.refresh();
			}));

	// List in Workflow Command toggle
	new Setting(contentContainer)
		.setName('List in run workflow command')
		.setDesc('Show this workflow in the list when running the run workflow command')
		.addToggle(toggle => toggle
			.setValue(workflow.showInCommand ?? true)
			.onChange(async (value) => {
				workflow.showInCommand = value;
				await plugin.saveSettings();
				// Preserve expand state when refreshing
				if (isExpanded()) {
					callbacks.setExpandState({ workflowId: workflow.id });
				}
				callbacks.refresh();
			}));

	// Output type selection (only show if workflow is listed in command)
	if (workflow.showInCommand ?? true) {
		new Setting(contentContainer)
			.setName('Output type')
			.setDesc('Choose how to display the transcription result')
			.addDropdown(dropdown => dropdown
				.addOptions(OUTPUT_TYPE_OPTIONS)
				.setValue(workflow.outputType || 'new-note')
				.onChange(async (value) => {
					workflow.outputType = value as WorkflowOutputType;
					await plugin.saveSettings();
					// Preserve expand state when refreshing (output folder visibility may change)
					if (isExpanded()) {
						callbacks.setExpandState({ workflowId: workflow.id });
					}
					callbacks.refresh();
				}));

		// Output folder (only show if output type is new-note)
		if (workflow.outputType === 'new-note') {
			createPathPicker({
				containerEl: contentContainer,
				app: plugin.app,
				name: 'Output folder',
				description: 'Folder where transcription notes will be created (leave empty to use default)',
				placeholder: 'Search for folder...',
				initialPath: workflow.outputFolder || '',
				onChange: async (path: string) => {
					workflow.outputFolder = path;
					await plugin.saveSettings();
				}
			});
		}
	}
}

/**
 * Display context section for chat workflows
 */
function displayContextSection(
	contentContainer: HTMLElement,
	plugin: AIToolboxPlugin,
	workflow: WorkflowConfig,
	callbacks: WorkflowSettingsCallbacks,
	isExpanded: () => boolean
): void {
	// Ensure contexts array exists
	if (!workflow.contexts) {
		workflow.contexts = [];
	}

	// Helper to check if a context type is enabled
	const isContextEnabled = (type: ChatContextType): boolean => {
		return workflow.contexts?.some(c => c.type === type) ?? false;
	};

	// Helper to toggle a context type
	const toggleContext = async (type: ChatContextType, enabled: boolean): Promise<void> => {
		if (!workflow.contexts) {
			workflow.contexts = [];
		}

		if (enabled) {
			// Add context if not already present
			if (!workflow.contexts.some(c => c.type === type)) {
				workflow.contexts.push({
					id: generateId(),
					type
				});
			}
		} else {
			// Remove context
			workflow.contexts = workflow.contexts.filter(c => c.type !== type);
		}

		await plugin.saveSettings();

		// Refresh to update the available tokens section
		if (isExpanded()) {
			// Check if available tokens section is expanded before refreshing
			const tokensContent = contentContainer.querySelector('.available-tokens-content');
			const tokensExpanded = tokensContent?.classList.contains('is-expanded') ?? false;
			callbacks.setExpandState({ workflowId: workflow.id, availableTokensExpanded: tokensExpanded });
		}
		callbacks.refresh();
	};

	// Context section container
	const contextSection = contentContainer.createDiv('context-section');

	// Section header
	contextSection.createDiv({ text: 'Context', cls: 'context-section-title' });

	// Toggles row
	const togglesRow = contextSection.createDiv('context-toggles-row');

	// Add labeled toggle for each context type
	const availableTypes = getAvailableContextTypes();
	for (const contextType of availableTypes) {
		const toggleContainer = togglesRow.createDiv('context-toggle-container');
		toggleContainer.setAttribute('aria-label', CHAT_CONTEXT_TYPE_DESCRIPTIONS[contextType]);

		const label = toggleContainer.createSpan('context-toggle-label');
		label.textContent = CHAT_CONTEXT_TYPE_LABELS[contextType];

		const toggleWrapper = toggleContainer.createDiv('context-toggle-wrapper');
		new Setting(toggleWrapper)
			.addToggle(toggle => toggle
				.setValue(isContextEnabled(contextType))
				.onChange(async (value) => {
					await toggleContext(contextType, value);
				}));
	}

	// Workflow context section (select other workflows as input)
	displayWorkflowContextSection(contextSection, plugin, workflow, callbacks, isExpanded);

	// Available tokens section (inside the context section)
	displayAvailableTokensSection(contextSection, workflow, plugin, callbacks);
}

/**
 * Display workflow context section for selecting other workflows as input
 */
function displayWorkflowContextSection(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	workflow: WorkflowConfig,
	callbacks: WorkflowSettingsCallbacks,
	isExpanded: () => boolean
): void {
	// Ensure workflowContexts array exists
	if (!workflow.workflowContexts) {
		workflow.workflowContexts = [];
	}

	// Get workflows that are available as input (excluding current workflow)
	const availableWorkflows = plugin.settings.workflows.filter(
		w => w.availableAsInput && w.id !== workflow.id
	);

	// Workflow context subsection
	const workflowSection = containerEl.createDiv('workflow-context-section');

	// Dropdown to select a workflow
	const dropdownContainer = workflowSection.createDiv('workflow-context-dropdown-container');

	// Build options for dropdown
	const selectedWorkflowIds = new Set(workflow.workflowContexts?.map(wc => wc.workflowId) ?? []);
	const unselectedWorkflows = availableWorkflows.filter(w => !selectedWorkflowIds.has(w.id));

	// Determine if dropdown should be disabled
	const isDisabled = unselectedWorkflows.length === 0;

	new Setting(dropdownContainer)
		.setName('Add workflow')
		.setDesc('Select a workflow to use as context')
		.addDropdown(dropdown => {
			dropdown.addOption('', 'Select a workflow...');
			for (const w of unselectedWorkflows) {
				dropdown.addOption(w.id, w.name);
			}
			dropdown.setDisabled(isDisabled);
			if (isDisabled) {
				dropdown.selectEl.setAttribute('title', 'No additional valid workflows are available.');
			}
			dropdown.onChange(async (value) => {
				if (!value) return;

				if (!workflow.workflowContexts) {
					workflow.workflowContexts = [];
				}
				workflow.workflowContexts.push({ workflowId: value });
				await plugin.saveSettings();

				if (isExpanded()) {
					// Check if available tokens section is expanded before refreshing
					const tokensContent = workflowSection.parentElement?.querySelector('.available-tokens-content');
					const tokensExpanded = tokensContent?.classList.contains('is-expanded') ?? false;
					callbacks.setExpandState({ workflowId: workflow.id, availableTokensExpanded: tokensExpanded });
				}
				callbacks.refresh();
			});
		});

	// Display selected workflows with delete buttons
	const selectedWorkflowsContainer = workflowSection.createDiv('workflow-context-selected-list');

	for (const workflowContext of workflow.workflowContexts ?? []) {
		const selectedWorkflow = plugin.settings.workflows.find(w => w.id === workflowContext.workflowId);
		if (!selectedWorkflow) continue;

		const itemContainer = selectedWorkflowsContainer.createDiv('workflow-context-selected-item');

		const itemLabel = itemContainer.createSpan('workflow-context-selected-label');
		itemLabel.textContent = selectedWorkflow.name;

		const deleteButton = itemContainer.createEl('button', { cls: 'workflow-context-delete-button' });
		deleteButton.textContent = '×';
		deleteButton.setAttribute('aria-label', `Remove ${selectedWorkflow.name}`);
		deleteButton.addEventListener('click', () => {
			workflow.workflowContexts = workflow.workflowContexts?.filter(
				wc => wc.workflowId !== workflowContext.workflowId
			);

			void plugin.saveSettings().then(() => {
				if (isExpanded()) {
					// Check if available tokens section is expanded before refreshing
					const tokensContent = workflowSection.parentElement?.querySelector('.available-tokens-content');
					const tokensExpanded = tokensContent?.classList.contains('is-expanded') ?? false;
					callbacks.setExpandState({ workflowId: workflow.id, availableTokensExpanded: tokensExpanded });
				}
				callbacks.refresh();
			});
		});
	}
}

/**
 * Represents a group of tokens from a single source
 */
interface TokenGroup {
	name: string;
	tokens: TokenDefinition[];
	/** For workflow groups: the source workflow ID */
	workflowId?: string;
	/** For workflow groups: the source workflow type */
	workflowType?: WorkflowType;
	/** For transcription workflows: the timestamp granularity setting */
	timestampGranularity?: TimestampGranularity;
}

/**
 * Render a clickable token reference element with copy functionality
 */
function renderTokenReference(
	container: HTMLElement,
	token: TokenDefinition
): void {
	const listItem = container.createEl('li', { cls: 'available-tokens-item' });

	const tokenText = `{{${token.name}}}`;
	const tokenRef = listItem.createEl('code', { cls: 'available-tokens-reference' });
	tokenRef.textContent = tokenText;
	tokenRef.setAttribute('title', 'Click to copy');
	tokenRef.addEventListener('click', (e) => {
		e.stopPropagation();
		void navigator.clipboard.writeText(tokenText).then(() => {
			new Notice(`Copied ${tokenText}`);
		});
	});

	const tokenDesc = listItem.createSpan('available-tokens-description');
	tokenDesc.textContent = ` — ${token.description}`;
}

/**
 * Display the available tokens section showing tokens from all configured contexts
 */
function displayAvailableTokensSection(
	containerEl: HTMLElement,
	workflow: WorkflowConfig,
	plugin: AIToolboxPlugin,
	callbacks: WorkflowSettingsCallbacks
): void {
	const contexts = workflow.contexts ?? [];
	const workflowContexts = workflow.workflowContexts ?? [];

	// Check if there's anything to display
	const hasContexts = contexts.length > 0;
	const hasWorkflowContexts = workflowContexts.length > 0;

	if (!hasContexts && !hasWorkflowContexts) {
		return;
	}

	// Collect token groups
	const tokenGroups: TokenGroup[] = [];
	let totalTokenCount = 0;

	// Add context handler tokens as a single "Context" group
	if (hasContexts) {
		const contextTokens: TokenDefinition[] = [];
		for (const context of contexts) {
			const handler = createContextHandler(context.type);
			const tokens = handler.getAvailableTokens();
			contextTokens.push(...tokens);
		}
		if (contextTokens.length > 0) {
			tokenGroups.push({ name: 'Context', tokens: contextTokens });
			totalTokenCount += contextTokens.length;
		}
	}

	// Add workflow context tokens grouped by source workflow
	for (const workflowContext of workflowContexts) {
		const sourceWorkflow = plugin.settings.workflows.find(w => w.id === workflowContext.workflowId);
		if (!sourceWorkflow) continue;

		const workflowType = sourceWorkflow.type || 'chat';
		const timestampGranularity = sourceWorkflow.timestampGranularity;
		const workflowTokens = getWorkflowContextTokens(
			sourceWorkflow.id,
			workflowType,
			{ timestampGranularity }
		);
		if (workflowTokens.length > 0) {
			tokenGroups.push({
				name: sourceWorkflow.name || 'Unnamed workflow',
				tokens: workflowTokens,
				workflowId: sourceWorkflow.id,
				workflowType: workflowType,
				timestampGranularity: timestampGranularity
			});
			totalTokenCount += workflowTokens.length;
		}
	}

	if (totalTokenCount === 0) {
		return;
	}

	// Check if we should expand the tokens section
	const expandState = callbacks.getExpandState();
	const shouldExpand = expandState.availableTokensExpanded === true;

	// Create collapsible available tokens section
	const sectionContainer = containerEl.createDiv('available-tokens-section');

	const header = sectionContainer.createDiv('available-tokens-header');
	const headerArrow = header.createSpan('available-tokens-arrow');
	headerArrow.textContent = shouldExpand ? '▾' : '▸';

	const headerTitle = header.createSpan('available-tokens-title');
	headerTitle.textContent = `Available tokens (${totalTokenCount})`;

	const contentClasses = shouldExpand ? 'available-tokens-content is-expanded' : 'available-tokens-content is-collapsed';
	const content = sectionContainer.createDiv(contentClasses);

	const description = content.createDiv('available-tokens-description-text');
	description.textContent = 'These tokens available for use in prompts and output templates downstream.';

	// Render each token group
	for (const group of tokenGroups) {
		const groupContainer = content.createDiv('available-tokens-group');

		const groupHeader = groupContainer.createDiv('available-tokens-group-header');

		// Make workflow group headers clickable to copy full template
		if (group.workflowId && group.workflowType) {
			groupHeader.createSpan({ text: group.name });
			const copyIcon = groupHeader.createSpan({ cls: 'available-tokens-copy-icon' });
			setIcon(copyIcon, 'copy');
			groupHeader.addClass('is-clickable');
			groupHeader.setAttribute('title', 'Click to copy all tokens as template');
			const workflowId = group.workflowId;
			const workflowType = group.workflowType;
			const timestampGranularity = group.timestampGranularity;
			groupHeader.addEventListener('click', (e) => {
				e.stopPropagation();
				const template = generateWorkflowTokenTemplate(workflowId, workflowType, { timestampGranularity });
				void navigator.clipboard.writeText(template).then(() => {
					new Notice('Copied token template to clipboard');
				});
			});
		} else {
			groupHeader.textContent = group.name;
		}

		const tokenList = groupContainer.createEl('ul', { cls: 'available-tokens-list' });
		for (const token of group.tokens) {
			renderTokenReference(tokenList, token);
		}
	}

	// Toggle handler
	header.addEventListener('click', () => {
		const isCollapsed = content.classList.contains('is-collapsed');
		content.classList.toggle('is-collapsed', !isCollapsed);
		content.classList.toggle('is-expanded', isCollapsed);
		headerArrow.textContent = isCollapsed ? '▾' : '▸';
	});
}
