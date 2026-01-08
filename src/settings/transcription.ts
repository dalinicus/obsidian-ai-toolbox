import { Setting } from "obsidian";
import AIToolboxPlugin from "../main";
import { FolderSuggest } from "../components/folder-suggest";
import { createCollapsibleSection } from "../components/collapsible-section";

/**
 * Callbacks for the transcription settings tab to communicate with the main settings tab
 */
export interface TranscriptionSettingsCallbacks {
	refresh: () => void;
}

/**
 * Display the transcription settings tab content
 */
export function displayTranscriptionSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	callbacks: TranscriptionSettingsCallbacks
): void {
	// Transcription provider selection at the top
	displayTranscriptionProviderSelection(containerEl, plugin);

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
			.setValue(plugin.settings.impersonateBrowser)
			.onChange(async (value) => {
				plugin.settings.impersonateBrowser = value;
				await plugin.saveSettings();
			}));

	new Setting(containerEl)
		.setName('Language')
		.setDesc('Language code for transcription (e.g., en, es, fr). Leave empty for automatic detection')
		.addText(text => text
			.setPlaceholder('')
			.setValue(plugin.settings.transcriptionLanguage)
			.onChange(async (value) => {
				plugin.settings.transcriptionLanguage = value;
				await plugin.saveSettings();
			}));

	new Setting(containerEl)
		.setName('Include timestamps')
		.setDesc('Include timestamps in transcription notes for each chunk of text')
		.addToggle(toggle => toggle
			.setValue(plugin.settings.includeTimestamps)
			.onChange(async (value) => {
				plugin.settings.includeTimestamps = value;
				await plugin.saveSettings();
			}));

	new Setting(containerEl)
		.setName('Notes folder')
		.setDesc('Folder where transcription notes will be created (leave empty for vault root)')
		.addSearch(search => {
			search
				.setPlaceholder('Vault root')
				.setValue(plugin.settings.outputFolder)
				.onChange(async (value) => {
					plugin.settings.outputFolder = value;
					await plugin.saveSettings();
				});
			new FolderSuggest(plugin.app, search.inputEl);
		});

	new Setting(containerEl)
		.setName('Keep video file')
		.setDesc('Keep the original video file after extracting audio for transcription')
		.addToggle(toggle => toggle
			.setValue(plugin.settings.keepVideo)
			.onChange(async (value) => {
				plugin.settings.keepVideo = value;
				await plugin.saveSettings();
				callbacks.refresh();
			}));

	if (plugin.settings.keepVideo) {
		new Setting(containerEl)
			.setName('Output directory')
			.setDesc('Directory where video files will be saved (leave empty to use ~/Videos/Obsidian)') // eslint-disable-line obsidianmd/ui/sentence-case -- path example
			.addText(text => text
				.setPlaceholder('~/Videos/Obsidian') // eslint-disable-line obsidianmd/ui/sentence-case -- path example
				.setValue(plugin.settings.outputDirectory)
				.onChange(async (value) => {
					plugin.settings.outputDirectory = value;
					await plugin.saveSettings();
				}));
	}

	const { contentContainer: advancedContainer } = createCollapsibleSection({
		containerEl,
		title: 'Advanced',
		containerClass: 'settings-advanced-section',
		contentClass: 'settings-advanced-container',
		headerClass: 'settings-advanced-heading',
		startExpanded: false,
		isHeading: true,
	});

	new Setting(advancedContainer)
		.setName('yt-dlp path') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.setDesc('Path to yt-dlp binary directory (leave empty to use system PATH)') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.addText(text => text
			.setValue(plugin.settings.ytdlpLocation)
			.onChange(async (value) => {
				plugin.settings.ytdlpLocation = value;
				await plugin.saveSettings();
			}));

	new Setting(advancedContainer)
		.setName('FFmpeg path') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.setDesc('Path to FFmpeg binary directory (leave empty to use system PATH)') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.addText(text => text
			.setValue(plugin.settings.ffmpegLocation)
			.onChange(async (value) => {
				plugin.settings.ffmpegLocation = value;
				await plugin.saveSettings();
			}));
}

function displayTranscriptionProviderSelection(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin
): void {
	const providers = plugin.settings.providers;
	const currentSelection = plugin.settings.transcriptionProvider;

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
					plugin.settings.transcriptionProvider = null;
				} else {
					const parts = value.split(':');
					if (parts.length === 2 && parts[0] && parts[1]) {
						plugin.settings.transcriptionProvider = {
							providerId: parts[0],
							modelId: parts[1]
						};
					}
				}
				await plugin.saveSettings();
			}));
}

