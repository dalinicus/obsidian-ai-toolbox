import {Notice} from 'obsidian';
import {spawn} from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Buffer } from 'buffer';
import {AIToolboxSettings} from '../settings';
import { videoPlatformRegistry, VideoMetadata } from './video-platforms';

// Re-export VideoMetadata for backwards compatibility
export type { VideoMetadata } from './video-platforms';

export interface ExtractAudioResult {
    audioFilePath: string;
    sourceUrl: string;
    metadata?: VideoMetadata;
}

/**
 * Downloads audio from a video URL in the clipboard for transcription.
 * Supports TikTok, YouTube, and other platforms supported by yt-dlp.
 * Uses yt-dlp directly via child_process for audio extraction.
 * Requires yt-dlp and ffmpeg to be installed and available in PATH.
 */
export async function extractAudioFromClipboard(settings: AIToolboxSettings): Promise<ExtractAudioResult | null> {
    try {
        // Read URL from clipboard
        const clipboardText = await navigator.clipboard.readText();

        if (!clipboardText) {
            new Notice('Clipboard is empty');
            return null;
        }

        // Validate video URL
        if (!videoPlatformRegistry.isValidVideoUrl(clipboardText)) {
            new Notice('Clipboard does not contain a valid video URL');
            return null;
        }

        const url = clipboardText.trim();
        new Notice('Preparing video for transcription...');

        // Get platform-specific handler for output template
        const handler = videoPlatformRegistry.findHandlerForUrl(url);
        const filenameTemplate = handler
            ? handler.getYtDlpArgs().outputConfig.filenameTemplate
            : '%(title)s_%(id)s';

        let outputDir: string;

        if (settings.keepVideo) {
            // Use custom directory or default Downloads folder when keeping video
            const homeDir = os.homedir();
            outputDir = settings.outputDirectory ||
                path.join(homeDir, 'Videos', 'Obsidian');

            // Ensure output directory exists
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, {recursive: true});
            }
        } else {
            // Use system temporary directory when not keeping video
            outputDir = os.tmpdir();
        }

        // Use platform-specific output template
        const outputTemplate = path.join(outputDir, `${filenameTemplate}.%(ext)s`);

        // Run yt-dlp to extract audio for transcription and get metadata
        const ytdlpResult = await runYtDlp(url, outputTemplate, settings);

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

/**
 * Result from running yt-dlp including audio file path and video metadata
 */
interface YtDlpResult {
    audioFilePath: string;
    title?: string;
    uploader?: string;
    description?: string;
    tags?: string[];
}

/**
 * Structure of the yt-dlp info.json file (partial - only fields we use)
 */
interface YtDlpInfoJson {
    title?: string;
    uploader?: string;
    description?: string;
    tags?: string[];
    [key: string]: unknown;
}

/**
 * Runs yt-dlp to extract audio from a video for transcription.
 * Requires yt-dlp and ffmpeg to be installed and available in PATH.
 * Returns the actual filepath and video metadata reported by yt-dlp.
 */
async function runYtDlp(url: string, outputTemplate: string, settings: AIToolboxSettings): Promise<YtDlpResult> {
    const audioFilePath = await spawnYtDlp(url, outputTemplate, settings);

    // Read metadata from the .info.json file
    let metadata: YtDlpInfoJson | null = null;
    try {
        metadata = await readAndCleanupInfoJson(audioFilePath);
    } catch (error) {
        console.warn('Failed to read metadata, continuing without it:', error);
    }

    return {
        audioFilePath,
        title: metadata?.title,
        uploader: metadata?.uploader,
        description: metadata?.description,
        tags: metadata?.tags,
    };
}

/**
 * Spawns yt-dlp process and returns the audio file path.
 */
function spawnYtDlp(url: string, outputTemplate: string, settings: AIToolboxSettings): Promise<string> {
    return new Promise((resolve, reject) => {
        const args = [
            '-x',                    // Extract audio
            '--audio-format', 'mp3', // Convert to mp3
            '--audio-quality', '0',  // Best quality
            '--write-info-json',     // Write metadata to .info.json file
        ];

        // Keep video file if setting is enabled
        if (settings.keepVideo) {
            args.push('-k');
        }

        // Add ffmpeg location if specified in settings
        if (settings.ffmpegLocation) {
            args.push('--ffmpeg-location', settings.ffmpegLocation);
        }

        args.push(
            '--impersonate', settings.impersonateBrowser, // Impersonate browser from settings
            '-o', outputTemplate,    // Output template
            '--print', 'after_move:filepath',  // Print the final filepath after all processing
            url
        );

        let ytdlpCommand = 'yt-dlp';
        if (settings.ytdlpLocation) {
            ytdlpCommand = path.join(settings.ytdlpLocation, 'yt-dlp');
        }

        const proc = spawn(ytdlpCommand, args, {
            shell: false, // Don't pass back to the shell, prevents it seeing the templating as interpretable by the shell
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                const lines = stdout.trim().split('\n');
                const audioFilePath = lines[lines.length - 1]?.trim();

                if (audioFilePath && fs.existsSync(audioFilePath)) {
                    resolve(audioFilePath);
                } else {
                    reject(new Error(`yt-dlp did not return a valid filepath. Output: ${stdout}`));
                }
            } else {
                reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
            }
        });

        proc.on('error', (err) => {
            reject(new Error(`Failed to start yt-dlp: ${err.message}. Is yt-dlp installed?`));
        });
    });
}

/**
 * Reads metadata from the .info.json file created by yt-dlp and cleans it up.
 * The info.json file is created alongside the audio file with the same base name.
 */
async function readAndCleanupInfoJson(audioFilePath: string): Promise<YtDlpInfoJson | null> {
    try {
        // The info.json file has the same base name but with .info.json extension
        // e.g., "video_123.mp3" -> "video_123.info.json"
        const dir = path.dirname(audioFilePath);
        const basename = path.basename(audioFilePath, path.extname(audioFilePath));
        const infoJsonPath = path.join(dir, `${basename}.info.json`);

        if (fs.existsSync(infoJsonPath)) {
            const content = await fs.promises.readFile(infoJsonPath, 'utf-8');
            const metadata = JSON.parse(content) as YtDlpInfoJson;

            // Clean up the info.json file after reading
            await fs.promises.unlink(infoJsonPath);

            return {
                title: metadata.title || undefined,
                uploader: metadata.uploader || undefined,
                description: metadata.description || undefined,
                tags: Array.isArray(metadata.tags) && metadata.tags.length > 0
                    ? metadata.tags
                    : undefined,
            };
        }
    } catch (error) {
        console.warn('Failed to read or parse info.json:', error);
    }

    return null;
}



