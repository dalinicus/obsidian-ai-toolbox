import { MarkdownView, Notice } from 'obsidian';
import { InputHandler, InputContext, InputResult } from './types';
import { extractAudioFromUrl } from '../../processing';

/**
 * Input handler that extracts audio from a video URL in the current text selection.
 * Uses yt-dlp to download and convert the video to audio.
 *
 * Note: This is a legacy handler that uses default browser settings.
 * For per-action browser/cookie settings, use TokenUrlInputHandler instead.
 */
export class SelectionUrlInputHandler implements InputHandler {
    async getInput(context: InputContext): Promise<InputResult | null> {
        const activeView = context.app.workspace.getActiveViewOfType(MarkdownView);

        if (!activeView) {
            new Notice('No active editor. Please open a note and select a URL.');
            return null;
        }

        const editor = activeView.editor;
        const selection = editor.getSelection();

        if (!selection || !selection.trim()) {
            new Notice('No text selected. Please select a video URL.');
            return null;
        }

        const url = selection.trim();

        new Notice('Processing URL from selection...');

        const defaultExtractionSettings = {
            impersonateBrowser: 'chrome',
            useBrowserCookies: false
        };

        const result = await extractAudioFromUrl(url, context.settings, defaultExtractionSettings);

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

