import { Notice } from 'obsidian';
import { InputHandler, InputContext, InputResult } from './types';
import { extractAudioFromUrl } from '../../processing';

/**
 * Input handler that extracts audio from a URL resolved from a token value.
 * Uses yt-dlp to download and convert the video to audio.
 */
export class TokenUrlInputHandler implements InputHandler {
    private url: string;

    constructor(url: string) {
        this.url = url;
    }

    async getInput(context: InputContext): Promise<InputResult | null> {
        if (!this.url || !this.url.trim()) {
            new Notice('No URL found in the selected token');
            return null;
        }

        new Notice('Processing URL from token...');

        const result = await extractAudioFromUrl(this.url.trim(), context.settings);

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

