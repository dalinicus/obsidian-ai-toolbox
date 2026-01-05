import { requestUrl } from 'obsidian';
import {
    VideoPlatformHandler,
    EmbedConfig,
    YtDlpPlatformArgs,
} from './video-platform-handler';

/**
 * Interface for TikTok oEmbed API response.
 */
interface TikTokOEmbedResponse {
    html?: string;
    [key: string]: unknown;
}

/**
 * General regex patterns for TikTok URL detection.
 */
const TIKTOK_URL_PATTERNS = [
    /^https?:\/\/(www\.)?tiktok\.com\//i,
    /^https?:\/\/(vm|vt)\.tiktok\.com\//i,
] as const;

/**
 * Strict regex patterns for TikTok URL validation.
 * Used for validating specific TikTok URL formats compatible with yt-dlp.
 */
const TIKTOK_VALIDATION_PATTERNS = [
    /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i,
    /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w]+/i,
    /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/i,
] as const;

/**
 * Handler for TikTok video platform.
 * Implements URL detection, video ID extraction, embed generation, and yt-dlp configuration.
 */
export class TikTokHandler implements VideoPlatformHandler {
    readonly platformId = 'tiktok';
    readonly platformName = 'TikTok';

    matchesUrl(url: string): boolean {
        return TIKTOK_URL_PATTERNS.some(pattern => pattern.test(url));
    }

    isValidVideoUrl(url: string): boolean {
        const trimmedUrl = url.trim();
        return TIKTOK_VALIDATION_PATTERNS.some(pattern => pattern.test(trimmedUrl));
    }

    async extractVideoId(url: string): Promise<string | null> {
        try {
            const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
            const response = await requestUrl({
                url: oembedUrl,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Obsidian-AI-Toolbox/1.0)'
                }
            });

            if (response.status === 200) {
                const data = response.json as TikTokOEmbedResponse;
                if (data.html) {
                    const videoIdMatch = data.html.match(/data-video-id="(\d+)"/);
                    if (videoIdMatch?.[1]) {
                        return videoIdMatch[1];
                    }
                }
            }
        } catch (error) {
            console.error('Failed to extract video ID from TikTok URL:', error);
        }

        return null;
    }

    generateEmbed(videoId: string, sourceUrl: string): EmbedConfig {
        return {
            iframeHtml: `<iframe width="325" height="760" src="https://www.tiktok.com/embed/v2/${videoId}?autoplay=0"></iframe>`,
            markdownLink: `[Watch on TikTok](${sourceUrl})`,
        };
    }

    getYtDlpArgs(): YtDlpPlatformArgs {
        return {
            additionalArgs: [],
            outputConfig: {
                filenameTemplate: '%(uploader)s_%(id)s',
            },
        };
    }

    getDefaultTitle(): string {
        return 'TikTok';
    }
}

