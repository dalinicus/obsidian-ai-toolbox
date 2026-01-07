import { ModelProviderConfig, ChatMessage, ChatOptions } from './types';
import { AIProviderType, DEFAULT_OPENAI_ENDPOINT } from '../settings/index';
import { BaseProvider } from './base-model-provider';

/**
 * OpenAI model provider implementation.
 * Supports transcription and chat using Bearer token authentication.
 */
export class OpenAIModelProvider extends BaseProvider {
	readonly type: AIProviderType = 'openai';

	constructor(config: ModelProviderConfig) {
		// Apply default endpoint before calling super
		const configWithDefaults: ModelProviderConfig = {
			...config,
			endpoint: config.endpoint || DEFAULT_OPENAI_ENDPOINT,
		};
		super(configWithDefaults);
	}

	protected buildTranscriptionUrl(): string {
		const endpoint = this.endpoint.replace(/\/$/, '');
		return `${endpoint}/audio/transcriptions`;
	}

	protected buildChatUrl(): string {
		const endpoint = this.endpoint.replace(/\/$/, '');
		return `${endpoint}/chat/completions`;
	}

	protected getAuthHeaders(): Record<string, string> {
		return {
			'Authorization': `Bearer ${this.apiKey}`,
		};
	}

	protected validateTranscriptionConfig(): void {
		if (!this.apiKey) {
			throw new Error('OpenAI API key is not configured.');
		}
	}

	protected validateChatConfig(): void {
		if (!this.apiKey) {
			throw new Error('OpenAI API key is not configured.');
		}
	}

	protected buildChatRequestBody(messages: ChatMessage[], options: ChatOptions): Record<string, unknown> {
		const body: Record<string, unknown> = {
			model: this.modelId,
			messages: messages.map(m => ({ role: m.role, content: m.content })),
		};

		if (options.maxTokens !== undefined) {
			body.max_tokens = options.maxTokens;
		}
		if (options.temperature !== undefined) {
			body.temperature = options.temperature;
		}

		return body;
	}

	/**
	 * OpenAI API requires the model field in the request body
	 */
	protected override getAdditionalFormFields(): Array<{ name: string; value: string }> {
		return [
			{ name: 'model', value: this.modelId },
		];
	}
}

