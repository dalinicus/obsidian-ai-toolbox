import { Setting } from "obsidian";
import AIToolboxPlugin from "../main";

/**
 * Callbacks for the additional settings tab to communicate with the main settings tab
 */
export interface AdditionalSettingsCallbacks {
	refresh: () => void;
}

/**
 * Display the additional settings tab content
 */
export function displayAdditionalSettings(
	containerEl: HTMLElement,
	plugin: AIToolboxPlugin,
	callbacks: AdditionalSettingsCallbacks
): void {
	let showAdvanced = false;

	const advancedColor = 'var(--text-warning)';
	const advancedToggleSetting = new Setting(containerEl)
		.addToggle(toggle => toggle
			.setValue(showAdvanced)
			.onChange((value) => {
				showAdvanced = value;
				ytdlpPathSetting.settingEl.style.display = value ? '' : 'none';
				ffmpegPathSetting.settingEl.style.display = value ? '' : 'none';
				advancedLabel.style.color = value ? advancedColor : '';
				ytdlpPathSetting.nameEl.style.color = advancedColor;
				ffmpegPathSetting.nameEl.style.color = advancedColor;
			}));
	advancedToggleSetting.settingEl.style.justifyContent = 'flex-end';
	advancedToggleSetting.nameEl.style.display = 'none';
	const advancedLabel = advancedToggleSetting.controlEl.createSpan({ text: 'Show advanced settings' });
	advancedLabel.style.fontSize = '0.85em';
	advancedLabel.style.marginRight = '8px';
	advancedToggleSetting.controlEl.prepend(advancedLabel);

	// yt-dlp section header
	const ytdlpHeading = new Setting(containerEl)
		.setName('yt-dlp')
		.setHeading();
	ytdlpHeading.nameEl.style.fontSize = '1.17em';

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

	const ytdlpPathSetting = new Setting(containerEl)
		.setName('yt-dlp path') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.setDesc('Path to yt-dlp binary directory (leave empty to use system PATH)') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.addText(text => text
			.setValue(plugin.settings.ytdlpLocation)
			.onChange(async (value) => {
				plugin.settings.ytdlpLocation = value;
				await plugin.saveSettings();
			}));
	ytdlpPathSetting.settingEl.style.display = 'none';

	const ffmpegPathSetting = new Setting(containerEl)
		.setName('FFmpeg path') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.setDesc('Path to FFmpeg binary directory (leave empty to use system PATH)') // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
		.addText(text => text
			.setValue(plugin.settings.ffmpegLocation)
			.onChange(async (value) => {
				plugin.settings.ffmpegLocation = value;
				await plugin.saveSettings();
			}));
	ffmpegPathSetting.settingEl.style.display = 'none';
}

