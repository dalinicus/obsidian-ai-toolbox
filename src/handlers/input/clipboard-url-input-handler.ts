import { Notice } from 'obsidian';
import { InputHandler, InputContext, InputResult } from './types';
import { extractAudioFromUrl } from '../../processing';

/**
 * Input handler that extracts audio from a video URL in the clipboard.
 * Uses yt-dlp to download and convert the video to audio.
 *
 * Note: This is a legacy handler that uses default browser settings.
 * For per-action browser/cookie settings, use TokenUrlInputHandler instead.
 */
export class ClipboardUrlInputHandler implements InputHandler {
    async getInput(context: InputContext): Promise<InputResult | null> {
        new Notice('Checking clipboard for video URL...');

        let clipboardText: string;
        try {
            clipboardText = await navigator.clipboard.readText();
        } catch {
            new Notice('Failed to read clipboard');
            return null;
        }

        if (!clipboardText || !clipboardText.trim()) {
            new Notice('Clipboard is empty');
            return null;
        }

        const defaultExtractionSettings = {
            impersonateBrowser: 'chrome',
            useBrowserCookies: false
        };

        const result = await extractAudioFromUrl(clipboardText.trim(), context.settings, defaultExtractionSettings);

        if (!result) {
            return null;
        }

        return {
            audioFilePath: result.audioFilePath,
            sourceUrl: result.sourceUrl,
            metadata: result.metadata
        };
    }
}

