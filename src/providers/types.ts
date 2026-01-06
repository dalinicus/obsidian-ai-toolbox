import { AIProviderType } from '../settings';

/**
 * Options for audio transcription
 */
export interface TranscriptionOptions {
	includeTimestamps?: boolean;
	language?: string;
}

/**
 * Individual chunk with timestamps from transcription
 */
export interface TranscriptionChunk {
	text: string;
	timestamp: [number, number | null];
}

/**
 * Result from audio transcription
 */
export interface TranscriptionResult {
	text: string;
	chunks?: TranscriptionChunk[];
	audioFilePath: string;
}

/**
 * Configuration for creating a model provider instance
 */
export interface ModelProviderConfig {
	/** Unique identifier for this provider instance */
	id: string;
	/** Human-readable name for the provider */
	name: string;
	/** Human-readable name for the model */
	modelDisplayName: string;
	/** The type of provider (azure-openai, openai, anthropic) */
	type: AIProviderType;
	/** API endpoint URL */
	endpoint: string;
	/** API key for authentication */
	apiKey: string;
	/** Model or deployment identifier */
	modelId: string;
	/** Deployment name (for Azure, can be same as modelId for others) */
	deploymentName: string;
	/** Whether this model supports chat/conversation */
	supportsChat?: boolean;
	/** Whether this model supports audio transcription */
	supportsTranscription?: boolean;
}

/**
 * Common interface for AI model providers.
 * 
 * This interface defines the capabilities that each provider must implement,
 * allowing for polymorphic usage and dependency injection into workflows.
 */
export interface ModelProvider {
	/** The type of this provider */
	readonly type: AIProviderType;
	
	/** Human-readable name for this provider instance */
	readonly providerName: string;

	/**
	 * Transcribe an audio file to text.
	 * 
	 * @param audioFilePath - Path to the audio file (mp3, wav, m4a, webm, etc.)
	 * @param options - Transcription options (timestamps, language, etc.)
	 * @returns Promise resolving to transcription result with text and optional chunks
	 * @throws Error if transcription fails or is not supported by this provider
	 */
	transcribeAudio(audioFilePath: string, options?: TranscriptionOptions): Promise<TranscriptionResult>;

	/**
	 * Check if this provider supports audio transcription.
	 * 
	 * @returns true if transcribeAudio() is available
	 */
	supportsTranscription(): boolean;
}

