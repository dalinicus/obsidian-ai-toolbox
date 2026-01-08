// Video processor - yt-dlp related functionality
export {
    VideoProcessorConfig,
    YtDlpResult,
    getOutputDirectory,
    runYtDlp,
} from './video-processor';

// Video platforms - platform-specific handlers
export type {
    VideoPlatformHandler,
    VideoMetadata,
    YtDlpOutputConfig,
    YtDlpPlatformArgs,
    EmbedConfig,
} from './video-platforms';

export {
    YouTubeHandler,
    TikTokHandler,
    VideoPlatformRegistry,
    videoPlatformRegistry,
} from './video-platforms';

