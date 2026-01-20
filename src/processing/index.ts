// Audio processor - multipart form data and audio file handling
export {
    buildMultipartFormData,
    generateFormBoundary,
    validateAudioFile,
    extractFileName,
    prepareAudioFormData,
    createTestAudioBuffer,
    trimAudioFile,
} from './audio-processor';

export type {
    TranscriptionApiResponse,
    TranscriptionSegment,
    TranscriptionWord,
    TranscriptionChunk,
    TranscriptionResult,
    FormField,
    MultipartFormDataOptions,
    PrepareAudioFormDataOptions,
    PreparedAudioFormData,
    TestAudioData,
    TrimAudioOptions,
    TrimAudioResult,
} from './audio-processor';

// Video processor - yt-dlp related functionality
export {
    getOutputDirectory,
    runYtDlp,
    extractAudioFromUrl,
} from './video-processor';

export type {
    VideoProcessorConfig,
    VideoExtractionSettings,
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

