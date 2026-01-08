import { Notice, requestUrl } from 'obsidian';
import { ModelProvider, ModelProviderConfig, TranscriptionOptions, TranscriptionResult, ChatMessage, ChatOptions, ChatResult, TestAudioData } from './types';
import { AIProviderType } from '../settings';
import { prepareAudioFormData, TranscriptionApiResponse, FormField, buildMultipartFormData, generateFormBoundary } from '../processing/audio-processor';

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
		this.validateTranscriptionConfig();

		try {
			new Notice(`Transcribing audio with ${this.getProviderDisplayName()}`);

			const { boundary, formData } = prepareAudioFormData({
				audioFilePath,
				includeTimestamps: options.includeTimestamps || false,
				language: options.language,
				additionalFields: this.getAdditionalFormFields(),
			});

			const result = await this.sendTranscriptionRequest(boundary, formData);
			new Notice('Transcription complete!');

			return this.parseTranscriptionResponse(result, audioFilePath, options.includeTimestamps || false);
		} catch (error) {
			console.error('Transcription error:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			new Notice(`Transcription failed: ${errorMessage}`);
			throw error;
		}
	}

	async transcribeAudioBuffer(testAudio: TestAudioData): Promise<string> {
		this.validateTranscriptionConfig();

		const boundary = generateFormBoundary();
		const formData = buildMultipartFormData({
			boundary,
			audioBuffer: testAudio.audioBuffer,
			fileName: testAudio.fileName,
			includeTimestamps: false,
			additionalFields: this.getAdditionalFormFields(),
		});

		const result = await this.sendTranscriptionRequest(boundary, formData);
		return result.text;
	}

	private async sendTranscriptionRequest(boundary: string, formData: ArrayBuffer): Promise<TranscriptionApiResponse> {
		const apiUrl = this.buildTranscriptionUrl();
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

		return response.json as TranscriptionApiResponse;
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
	protected getAdditionalFormFields(): FormField[] {
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
