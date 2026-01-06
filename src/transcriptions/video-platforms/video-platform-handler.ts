/**
 * Video metadata extracted from a video platform.
 */
export interface VideoMetadata {
    title?: string;
    uploader?: string;
    description?: string;
    tags?: string[];
}

/**
 * yt-dlp output template configuration for a platform.
 */
export interface YtDlpOutputConfig {
    /** Output filename template (e.g., '%(uploader)s_%(id)s') */
    filenameTemplate: string;
}

/**
 * yt-dlp arguments specific to a platform.
 */
export interface YtDlpPlatformArgs {
    /** Additional command-line arguments for yt-dlp */
    additionalArgs: string[];
    /** Output configuration */
    outputConfig: YtDlpOutputConfig;
}

/**
 * Embed code configuration for embedding videos in notes.
 */
export interface EmbedConfig {
    /** HTML iframe code for embedding the video */
    iframeHtml: string;
    /** Markdown link to the video */
    markdownLink: string;
}

/**
 * Interface that all video platform handlers must implement.
 * Provides a consistent API for detecting, processing, and embedding videos
 * from different platforms (YouTube, TikTok, etc.).
 */
export interface VideoPlatformHandler {
    /** Unique identifier for this platform (e.g., 'youtube', 'tiktok') */
    readonly platformId: string;

    /** Human-readable name for this platform (e.g., 'YouTube', 'TikTok') */
    readonly platformName: string;

    /**
     * Checks if a URL belongs to this platform.
     * This is a quick check used for platform detection.
     * @param url - URL to check
     * @returns True if the URL is recognized as belonging to this platform
     */
    matchesUrl(url: string): boolean;

    /**
     * Validates if a URL is a supported video URL for this platform.
     * This is a stricter check that ensures the URL format is compatible with yt-dlp.
     * @param url - URL to validate
     * @returns True if the URL is a valid video URL for this platform
     */
    isValidVideoUrl(url: string): boolean;

    /**
     * Extracts the video ID from a URL.
     * @param url - Video URL
     * @returns Video ID or null if extraction fails
     */
    extractVideoId(url: string): Promise<string | null>;

    /**
     * Generates embed code for displaying the video in a note.
     * @param videoId - Platform-specific video ID
     * @returns Embed configuration with iframe HTML and markdown link
     */
    generateEmbed(videoId: string, sourceUrl: string): EmbedConfig;

    /**
     * Gets platform-specific yt-dlp arguments.
     * @returns Configuration for yt-dlp including additional args and output template
     */
    getYtDlpArgs(): YtDlpPlatformArgs;

    /**
     * Gets the title to use for notes based on video metadata.
     * @param metadata - Optional video metadata from yt-dlp
     * @returns Title string for this video
     */
    getTitle(metadata?: VideoMetadata): string;
}

