import { Setting } from "obsidian";
import AIToolboxPlugin from "../main";
import {
	WorkflowConfig,
	WorkflowOutputType,
	PromptSourceType,
	ExpandOnNextRenderState,
	generateId,
	DEFAULT_WORKFLOW_CONFIG
} from "./types";
import { createCollapsibleSection } from "../components/collapsible-section";
import { createPathPicker } from "../components/path-picker";

/**
 * Callbacks for the workflows settings tab to communicate with the main settings tab
 */
export interface WorkflowSettingsCallbacks {
	getExpandState: () => ExpandOnNextRenderState;
	setExpandState: (state: ExpandOnNextRenderState) => void;
	refresh: () => void;
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
			.onClick(async () => {
				const newWorkflow: WorkflowConfig = {
					id: generateId(),
					...DEFAULT_WORKFLOW_CONFIG
				};
				plugin.settings.workflows.push(newWorkflow);
				// Expand the newly created workflow
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

	const { contentContainer, updateTitle, isExpanded } = createCollapsibleSection({
		containerEl,
		title: workflow.name || 'Unnamed workflow',
		containerClass: 'workflow-container',
		contentClass: 'workflow-content',
		headerClass: 'workflow-header',
		startExpanded: shouldExpand,
		isHeading: true,
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

	// Provider/Model selection (only models that support chat)
	displayWorkflowProviderSelection(contentContainer, plugin, workflow);

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
			mode: 'folder-file',
			containerEl: contentContainer,
			app: plugin.app,
			name: 'Prompt file',
			description: 'First select a folder to filter, then select a file from that folder',
			initialFolderPath: workflow.promptFolderPath ?? '',
			initialFilePath: workflow.promptFilePath ?? '',
			folderPlaceholder: 'Select folder...',
			filePlaceholder: 'Select file...',
			onFolderChange: async (folderPath: string) => {
				workflow.promptFolderPath = folderPath;
				await plugin.saveSettings();
			},
			onFileChange: async (filePath: string) => {
				workflow.promptFilePath = filePath;
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
			}));

	// List in Workload Command toggle
	new Setting(contentContainer)
		.setName('List in "Run AI Workflow" Command')
		.setDesc('Show this workflow in the list when running the "Run AI Workflow" command')
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
				mode: 'folder-only',
				containerEl: contentContainer,
				app: plugin.app,
				name: 'Output folder',
				description: 'Folder where notes will be created (leave empty to use default)',
				folderPlaceholder: 'Default folder',
				initialFolderPath: workflow.outputFolder || '',
				onFolderChange: async (folderPath: string) => {
					workflow.outputFolder = folderPath;
					await plugin.saveSettings();
				}
			});
		}
	}

	// Clear the expand state after rendering this workflow
	if (expandState.workflowId === workflow.id) {
		callbacks.setExpandState({});
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

