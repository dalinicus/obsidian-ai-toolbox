import { Notice, requestUrl } from 'obsidian';
import * as fs from 'fs';
import { Buffer } from 'buffer';
import { ModelProvider, ModelProviderConfig, TranscriptionOptions, TranscriptionResult, ChatMessage, ChatOptions, ChatResult } from './types';
import { AIProviderType } from '../settings';

/**
 * Interface for transcription API response
 */
export interface TranscriptionApiResponse {
	text: string;
	segments?: Array<{ text: string; start: number; end: number }>;
}

/**
 * Abstract base class for AI model providers.
 * Contains shared implementation for transcription and other capabilities.
 * Concrete providers extend this class and implement provider-specific methods.
 */
/**
 * Interface for chat API response (OpenAI-compatible format)
 */
export interface ChatApiResponse {
	choices: Array<{
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * Abstract base class for AI model providers.
 * Contains shared implementation for transcription and other capabilities.
 * Concrete providers extend this class and implement provider-specific methods.
 */
export abstract class BaseProvider implements ModelProvider {
	abstract readonly type: AIProviderType;
	readonly providerName: string;

	protected readonly endpoint: string;
	protected readonly apiKey: string;
	protected readonly modelId: string;
	protected readonly deploymentName: string;
	protected readonly modelDisplayName: string;
	private readonly _supportsTranscription: boolean;
	private readonly _supportsChat: boolean;

	constructor(config: ModelProviderConfig) {
		this.providerName = config.name;
		this.modelDisplayName = config.modelDisplayName;
		this.endpoint = config.endpoint;
		this.apiKey = config.apiKey;
		this.modelId = config.modelId;
		this.deploymentName = config.deploymentName || config.modelId;
		this._supportsTranscription = config.supportsTranscription ?? false;
		this._supportsChat = config.supportsChat ?? false;
	}

	supportsTranscription(): boolean {
		return this._supportsTranscription;
	}

	supportsChat(): boolean {
		return this._supportsChat;
	}

	async sendChat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
		this.validateChatConfig();

		try {
			const apiUrl = this.buildChatUrl();
			const requestBody = this.buildChatRequestBody(messages, options);

			const response = await requestUrl({
				url: apiUrl,
				method: 'POST',
				headers: {
					...this.getAuthHeaders(),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
			});

			if (response.status !== 200) {
				throw new Error(`${this.getProviderDisplayName()} API error: ${response.status} - ${response.text}`);
			}

			const result = response.json as ChatApiResponse;
			return this.parseChatResponse(result);
		} catch (error) {
			console.error('Chat error:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Chat failed: ${errorMessage}`);
		}
	}

	async transcribeAudio(audioFilePath: string, options: TranscriptionOptions = {}): Promise<TranscriptionResult> {
		if (!fs.existsSync(audioFilePath)) {
			throw new Error(`Audio file not found: ${audioFilePath}`);
		}

		this.validateTranscriptionConfig();

		try {
			new Notice(`Transcribing audio with ${this.getProviderDisplayName()}`);

			const audioBuffer = fs.readFileSync(audioFilePath);
			const fileName = audioFilePath.split(/[/\\]/).pop() || 'audio.mp3';
			const apiUrl = this.buildTranscriptionUrl();

			const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
			const formData = this.buildMultipartFormData(
				boundary,
				audioBuffer,
				fileName,
				options.includeTimestamps || false,
				options.language
			);

			const response = await requestUrl({
				url: apiUrl,
				method: 'POST',
				headers: {
					...this.getAuthHeaders(),
					'Content-Type': `multipart/form-data; boundary=${boundary}`,
				},
				body: formData,
			});

			if (response.status !== 200) {
				throw new Error(`${this.getProviderDisplayName()} API error: ${response.status} - ${response.text}`);
			}

			const result = response.json as TranscriptionApiResponse;
			new Notice('Transcription complete!');

			return this.parseTranscriptionResponse(result, audioFilePath, options.includeTimestamps || false);
		} catch (error) {
			console.error('Transcription error:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			new Notice(`Transcription failed: ${errorMessage}`);
			throw error;
		}
	}

	/**
	 * Get display name for this provider (used in notices)
	 */
	protected getProviderDisplayName(): string {
		return `${this.providerName} - ${this.modelDisplayName}`;
	}

	/**
	 * Build the API URL for transcription requests
	 */
	protected abstract buildTranscriptionUrl(): string;

	/**
	 * Build the API URL for chat requests
	 */
	protected abstract buildChatUrl(): string;

	/**
	 * Get authentication headers for API requests
	 */
	protected abstract getAuthHeaders(): Record<string, string>;

	/**
	 * Validate provider-specific configuration for transcription
	 */
	protected abstract validateTranscriptionConfig(): void;

	/**
	 * Validate provider-specific configuration for chat
	 */
	protected abstract validateChatConfig(): void;

	/**
	 * Build the request body for chat completion
	 */
	protected abstract buildChatRequestBody(messages: ChatMessage[], options: ChatOptions): Record<string, unknown>;

	/**
	 * Get additional form fields for the multipart request (e.g., model field for OpenAI)
	 */
	protected getAdditionalFormFields(): Array<{ name: string; value: string }> {
		return [];
	}

	/**
	 * Parse the chat API response into a ChatResult
	 */
	protected parseChatResponse(response: ChatApiResponse): ChatResult {
		const choice = response.choices[0];
		if (!choice) {
			throw new Error('No response from chat API');
		}

		const result: ChatResult = {
			content: choice.message.content,
		};

		if (response.usage) {
			result.usage = {
				promptTokens: response.usage.prompt_tokens,
				completionTokens: response.usage.completion_tokens,
				totalTokens: response.usage.total_tokens,
			};
		}

		return result;
	}

	protected buildMultipartFormData(
		boundary: string,
		audioBuffer: Buffer,
		fileName: string,
		includeTimestamps: boolean,
		language?: string
	): ArrayBuffer {
		const parts: (string | Buffer)[] = [];

		// File field
		parts.push(`--${boundary}\r\n`);
		parts.push(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`);
		parts.push(`Content-Type: application/octet-stream\r\n\r\n`);
		parts.push(audioBuffer);
		parts.push('\r\n');

		// Additional provider-specific fields (e.g., model for OpenAI)
		for (const field of this.getAdditionalFormFields()) {
			parts.push(`--${boundary}\r\n`);
			parts.push(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n`);
			parts.push(`${field.value}\r\n`);
		}

		// Response format
		const responseFormat = includeTimestamps ? 'verbose_json' : 'json';
		parts.push(`--${boundary}\r\n`);
		parts.push(`Content-Disposition: form-data; name="response_format"\r\n\r\n`);
		parts.push(`${responseFormat}\r\n`);

		// Language (optional)
		if (language) {
			parts.push(`--${boundary}\r\n`);
			parts.push(`Content-Disposition: form-data; name="language"\r\n\r\n`);
			parts.push(`${language}\r\n`);
		}

		// Timestamp granularities (for verbose_json)
		if (includeTimestamps) {
			parts.push(`--${boundary}\r\n`);
			parts.push(`Content-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\n`);
			parts.push(`segment\r\n`);
		}

		parts.push(`--${boundary}--\r\n`);

		return this.combinePartsToArrayBuffer(parts);
	}

	private combinePartsToArrayBuffer(parts: (string | Buffer)[]): ArrayBuffer {
		const encoder = new TextEncoder();
		const buffers: Uint8Array[] = parts.map(part => {
			if (typeof part === 'string') {
				return encoder.encode(part);
			}
			return new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
		});

		const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
		const combined = new Uint8Array(totalLength);
		let offset = 0;
		for (const buf of buffers) {
			combined.set(new Uint8Array(buf), offset);
			offset += buf.byteLength;
		}

		return combined.buffer;
	}

	protected parseTranscriptionResponse(
		response: TranscriptionApiResponse,
		audioFilePath: string,
		includeTimestamps: boolean
	): TranscriptionResult {
		const result: TranscriptionResult = {
			text: response.text,
			audioFilePath,
		};

		if (includeTimestamps && response.segments) {
			result.chunks = response.segments.map(segment => ({
				text: segment.text.trim(),
				timestamp: [segment.start, segment.end] as [number, number],
			}));
		}

		return result;
	}
}
