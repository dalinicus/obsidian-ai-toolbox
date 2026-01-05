// Video platform handler interface and types
export type {
    VideoPlatformHandler,
    VideoMetadata,
    YtDlpOutputConfig,
    YtDlpPlatformArgs,
    EmbedConfig,
} from './video-platform-handler';

// Platform implementations
export { YouTubeHandler } from './youtube-handler';
export { TikTokHandler } from './tiktok-handler';

// Registry
export { VideoPlatformRegistry, videoPlatformRegistry } from './video-platform-registry';

