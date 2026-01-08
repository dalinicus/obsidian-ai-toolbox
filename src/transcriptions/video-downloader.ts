import { Notice } from 'obsidian';
import * as path from 'path';
import { AIToolboxSettings } from '../settings';
import {
    videoPlatformRegistry,
    VideoMetadata,
    getOutputDirectory,
    runYtDlp,
    VideoProcessorConfig,
} from '../processing';

// Re-export types for backwards compatibility
export type { VideoMetadata } from '../processing';

export interface ExtractAudioResult {
    audioFilePath: string;
    sourceUrl: string;
    metadata?: VideoMetadata;
}

/**
 * Converts AIToolboxSettings to VideoProcessorConfig.
 */
function settingsToProcessorConfig(settings: AIToolboxSettings): VideoProcessorConfig {
    return {
        ytdlpLocation: settings.ytdlpLocation,
        ffmpegLocation: settings.ffmpegLocation,
        impersonateBrowser: settings.impersonateBrowser,
        keepVideo: settings.keepVideo,
        outputDirectory: settings.outputDirectory,
    };
}

/**
 * Downloads audio from a video URL in the clipboard for transcription.
 * Supports TikTok, YouTube, and other platforms supported by yt-dlp.
 * Uses yt-dlp directly via child_process for audio extraction.
 * Requires yt-dlp and ffmpeg to be installed and available in PATH.
 */
export async function extractAudioFromClipboard(settings: AIToolboxSettings): Promise<ExtractAudioResult | null> {
    try {
        const clipboardText = await navigator.clipboard.readText();

        if (!clipboardText) {
            new Notice('Clipboard is empty');
            return null;
        }

        if (!videoPlatformRegistry.isValidVideoUrl(clipboardText)) {
            new Notice('Clipboard does not contain a valid video URL');
            return null;
        }

        const url = clipboardText.trim();
        new Notice('Preparing video for transcription...');

        const handler = videoPlatformRegistry.findHandlerForUrl(url);
        const filenameTemplate = handler
            ? handler.getYtDlpArgs().outputConfig.filenameTemplate
            : '%(title)s_%(id)s';

        const config = settingsToProcessorConfig(settings);
        const outputDir = getOutputDirectory(config);
        const outputTemplate = path.join(outputDir, `${filenameTemplate}.%(ext)s`);

        const ytdlpResult = await runYtDlp(url, outputTemplate, config);

        new Notice(`Audio extracted successfully!\nReady for transcription.\nSaved to: ${path.dirname(ytdlpResult.audioFilePath)}`);

        return {
            audioFilePath: ytdlpResult.audioFilePath,
            sourceUrl: url,
            metadata: {
                title: ytdlpResult.title,
                uploader: ytdlpResult.uploader,
                description: ytdlpResult.description,
                tags: ytdlpResult.tags,
            },
        };

    } catch (error) {
        console.error('Video audio extraction error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        new Notice(`Failed to extract audio for transcription: ${errorMessage}`);
        return null;
    }
}



