import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Buffer } from 'buffer';

/**
 * Configuration for video processing operations.
 */
export interface VideoProcessorConfig {
    ytdlpLocation?: string;
    ffmpegLocation?: string;
    impersonateBrowser: string;
    keepVideo: boolean;
    outputDirectory?: string;
}

/**
 * Result from running yt-dlp including audio file path and video metadata.
 */
export interface YtDlpResult {
    audioFilePath: string;
    title?: string;
    uploader?: string;
    description?: string;
    tags?: string[];
}

/**
 * Structure of the yt-dlp info.json file (partial - only fields we use).
 */
interface YtDlpInfoJson {
    title?: string;
    uploader?: string;
    description?: string;
    tags?: string[];
    [key: string]: unknown;
}

/**
 * Determines the output directory for downloaded videos/audio.
 */
export function getOutputDirectory(config: VideoProcessorConfig): string {
    if (config.keepVideo) {
        const homeDir = os.homedir();
        const outputDir = config.outputDirectory || path.join(homeDir, 'Videos', 'Obsidian');

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        return outputDir;
    }
    return os.tmpdir();
}

/**
 * Runs yt-dlp to extract audio from a video for transcription.
 * Requires yt-dlp and ffmpeg to be installed and available in PATH.
 * Returns the actual filepath and video metadata reported by yt-dlp.
 */
export async function runYtDlp(
    url: string,
    outputTemplate: string,
    config: VideoProcessorConfig
): Promise<YtDlpResult> {
    const audioFilePath = await spawnYtDlp(url, outputTemplate, config);

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
function spawnYtDlp(
    url: string,
    outputTemplate: string,
    config: VideoProcessorConfig
): Promise<string> {
    return new Promise((resolve, reject) => {
        const args = [
            '-x',                    // Extract audio
            '--audio-format', 'mp3', // Convert to mp3
            '--audio-quality', '0',  // Best quality
            '--write-info-json',     // Write metadata to .info.json file
        ];

        if (config.keepVideo) {
            args.push('-k');
        }

        if (config.ffmpegLocation) {
            args.push('--ffmpeg-location', config.ffmpegLocation);
        }

        args.push(
            '--impersonate', config.impersonateBrowser,
            '-o', outputTemplate,
            '--print', 'after_move:filepath',
            url
        );

        let ytdlpCommand = 'yt-dlp';
        if (config.ytdlpLocation) {
            ytdlpCommand = path.join(config.ytdlpLocation, 'yt-dlp');
        }

        const proc = spawn(ytdlpCommand, args, {
            shell: false,
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
        const dir = path.dirname(audioFilePath);
        const basename = path.basename(audioFilePath, path.extname(audioFilePath));
        const infoJsonPath = path.join(dir, `${basename}.info.json`);

        if (fs.existsSync(infoJsonPath)) {
            const content = await fs.promises.readFile(infoJsonPath, 'utf-8');
            const metadata = JSON.parse(content) as YtDlpInfoJson;

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

