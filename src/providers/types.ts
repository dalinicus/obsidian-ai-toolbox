import { AIProviderType } from '../settings';
import { TestAudioData } from '../processing/audio-processor';

// Re-export TestAudioData for consumers of this module
export type { TestAudioData };

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
 * Role for chat messages
 */
export type ChatMessageRole = 'system' | 'user' | 'assistant';

/**
 * A single message in a chat conversation
 */
export interface ChatMessage {
	role: ChatMessageRole;
	content: string;
}

/**
 * Options for chat completion requests
 */
export interface ChatOptions {
	/** Maximum tokens to generate */
	maxTokens?: number;
	/** Temperature for response randomness (0-2) */
	temperature?: number;
}

/**
 * Result from a chat completion request
 */
export interface ChatResult {
	/** The generated response content */
	content: string;
	/** Token usage information if available */
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
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
	 * Transcribe audio using a raw audio buffer.
	 * Useful for testing without writing to disk.
	 *
	 * @param testAudio - Audio buffer and filename
	 * @returns Promise resolving to the transcription text
	 * @throws Error if transcription fails or is not supported by this provider
	 */
	transcribeAudioBuffer(testAudio: TestAudioData): Promise<string>;

	/**
	 * Check if this provider supports audio transcription.
	 *
	 * @returns true if transcribeAudio() is available
	 */
	supportsTranscription(): boolean;

	/**
	 * Send a chat completion request.
	 *
	 * @param messages - Array of chat messages forming the conversation
	 * @param options - Optional chat options (max tokens, temperature, etc.)
	 * @returns Promise resolving to chat result with generated content
	 * @throws Error if chat fails or is not supported by this provider
	 */
	sendChat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;

	/**
	 * Check if this provider supports chat/conversation.
	 *
	 * @returns true if sendChat() is available
	 */
	supportsChat(): boolean;
}

