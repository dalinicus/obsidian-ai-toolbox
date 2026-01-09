import {
    VideoPlatformHandler,
    EmbedConfig,
    YtDlpPlatformArgs,
    VideoMetadata,
} from './video-platform-handler';

/**
 * General regex patterns for YouTube URL detection.
 */
const YOUTUBE_URL_PATTERNS = [
    /^https?:\/\/(www\.)?youtube\.com\//i,
    /^https?:\/\/youtu\.be\//i,
] as const;

/**
 * Strict regex patterns for YouTube URL validation.
 * Used for validating specific YouTube URL formats compatible with yt-dlp.
 */
const YOUTUBE_VALIDATION_PATTERNS = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/i,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/i,
    /^https?:\/\/youtu\.be\/[\w-]+/i,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/i,
] as const;

/**
 * Handler for YouTube video platform.
 * Implements URL detection, video ID extraction, embed generation, and yt-dlp configuration.
 */
export class YouTubeHandler implements VideoPlatformHandler {
    readonly platformId = 'youtube';
    readonly platformName = 'YouTube';

    matchesUrl(url: string): boolean {
        return YOUTUBE_URL_PATTERNS.some(pattern => pattern.test(url));
    }

    isValidVideoUrl(url: string): boolean {
        const trimmedUrl = url.trim();
        return YOUTUBE_VALIDATION_PATTERNS.some(pattern => pattern.test(trimmedUrl));
    }

    async extractVideoId(url: string): Promise<string | null> {
        // Handle youtu.be/VIDEO_ID
        const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (shortMatch?.[1]) return shortMatch[1];

        // Handle youtube.com/watch?v=VIDEO_ID
        const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
        if (watchMatch?.[1]) return watchMatch[1];

        // Handle youtube.com/shorts/VIDEO_ID
        const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
        if (shortsMatch?.[1]) return shortsMatch[1];

        // Handle youtube.com/embed/VIDEO_ID
        const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]+)/);
        if (embedMatch?.[1]) return embedMatch[1];

        return null;
    }

    generateEmbed(videoId: string, sourceUrl: string): EmbedConfig {
        return {
            iframeHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`,
            markdownLink: `[Watch on YouTube](${sourceUrl})`,
        };
    }

    getYtDlpArgs(): YtDlpPlatformArgs {
        return {
            additionalArgs: [],
            outputConfig: {
                filenameTemplate: '%(title)s_%(id)s',
            },
        };
    }

    getTitle(metadata?: VideoMetadata): string {
        return metadata?.title || 'Video';
    }
}

