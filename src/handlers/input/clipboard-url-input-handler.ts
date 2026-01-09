import { Notice } from 'obsidian';
import { InputHandler, InputContext, InputResult } from './types';
import { extractAudioFromClipboard } from '../../processing';

/**
 * Input handler that extracts audio from a video URL in the clipboard.
 * Uses yt-dlp to download and convert the video to audio.
 */
export class ClipboardUrlInputHandler implements InputHandler {
    async getInput(context: InputContext): Promise<InputResult | null> {
        new Notice('Checking clipboard for video URL...');

        const result = await extractAudioFromClipboard(context.settings);

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

