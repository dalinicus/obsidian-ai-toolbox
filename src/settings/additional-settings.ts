import { Setting } from "obsidian";
import AIToolboxPlugin from "../main";

/**
 * Callbacks for the additional settings tab to communicate with the main settings tab
 */
export interface AdditionalSettingsCallbacks {
	refresh: () => void;
	isAdvancedVisible: () => boolean;
}

/**
 * Display the additional settings tab content
 */
export function displayAdditionalSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	callbacks: AdditionalSettingsCallbacks
): void {
	const showAdvanced = callbacks.isAdvancedVisible();

	// yt-dlp section header
	const ytdlpHeading = new Setting(containerEl)
		.setName('yt-dlp') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.setHeading();
	ytdlpHeading.settingEl.addClass('additional-settings-heading');

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
		.setName('Use cookies from browser')
		.setDesc('Extract cookies from a browser for authentication (required for some age-restricted or private content)')
		.addDropdown(dropdown => dropdown
			.addOption('', 'None')
			.addOption('chrome', 'Chrome')
			.addOption('edge', 'Edge')
			.addOption('safari', 'Safari')
			.addOption('firefox', 'Firefox')
			.addOption('brave', 'Brave')
			.addOption('chromium', 'Chromium')
			.addOption('opera', 'Opera')
			.addOption('vivaldi', 'Vivaldi')
			.setValue(plugin.settings.cookiesFromBrowser)
			.onChange(async (value) => {
				plugin.settings.cookiesFromBrowser = value;
				await plugin.saveSettings();
			}));

	const ytdlpPathSetting = new Setting(containerEl)
		.setName('yt-dlp path') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.setDesc('Path to yt-dlp binary directory (leave empty to use system PATH)') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.addText(text => text
			.setValue(plugin.settings.ytdlpLocation)
			.onChange(async (value) => {
				plugin.settings.ytdlpLocation = value;
				await plugin.saveSettings();
			}));
	ytdlpPathSetting.settingEl.toggleClass('settings-advanced-hidden', !showAdvanced);
	if (showAdvanced) {
		ytdlpPathSetting.nameEl.addClass('settings-advanced-name');
	}

	const ffmpegPathSetting = new Setting(containerEl)
		.setName('FFmpeg path') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.setDesc('Path to FFmpeg binary directory (leave empty to use system PATH)') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.addText(text => text
			.setValue(plugin.settings.ffmpegLocation)
			.onChange(async (value) => {
				plugin.settings.ffmpegLocation = value;
				await plugin.saveSettings();
			}));
	ffmpegPathSetting.settingEl.toggleClass('settings-advanced-hidden', !showAdvanced);
	if (showAdvanced) {
		ffmpegPathSetting.nameEl.addClass('settings-advanced-name');
	}
}

