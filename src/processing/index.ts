// Audio processor - multipart form data and audio file handling
export {
    buildMultipartFormData,
    generateFormBoundary,
    validateAudioFile,
    extractFileName,
    prepareAudioFormData,
    createTestAudioBuffer,
} from './audio-processor';

export type {
    TranscriptionApiResponse,
    TranscriptionChunk,
    TranscriptionResult,
    FormField,
    MultipartFormDataOptions,
    PrepareAudioFormDataOptions,
    PreparedAudioFormData,
    TestAudioData,
} from './audio-processor';

// Video processor - yt-dlp related functionality
export {
    getOutputDirectory,
    runYtDlp,
    extractAudioFromUrl,
    extractAudioFromClipboard,
} from './video-processor';

export type {
    VideoProcessorConfig,
    YtDlpResult,
    ExtractAudioResult,
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

