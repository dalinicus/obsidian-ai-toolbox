import { ModelProviderConfig, ChatMessage, ChatOptions } from './types';
import { AIProviderType } from '../settings';
import { BaseProvider } from './base-provider';

/**
 * Azure OpenAI model provider implementation.
 * Supports transcription and chat using Azure-specific authentication and deployment-based endpoints.
 */
export class AzureOpenAIModelProvider extends BaseProvider {
	readonly type: AIProviderType = 'azure-openai';
	private static readonly CHAT_API_VERSION = '2024-06-01';
	private static readonly TRANSCRIPTION_API_VERSION = '2024-06-01';

	constructor(config: ModelProviderConfig) {
		super(config);
	}

	protected buildTranscriptionUrl(): string {
		const endpoint = this.endpoint.replace(/\/$/, '');
		return `${endpoint}/openai/deployments/${this.deploymentName}/audio/transcriptions?api-version=${AzureOpenAIModelProvider.TRANSCRIPTION_API_VERSION}`;
	}

	protected buildChatUrl(): string {
		const endpoint = this.endpoint.replace(/\/$/, '');
		return `${endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${AzureOpenAIModelProvider.CHAT_API_VERSION}`;
	}

	protected getAuthHeaders(): Record<string, string> {
		return {
			'api-key': this.apiKey,
		};
	}

	protected validateTranscriptionConfig(): void {
		if (!this.endpoint) {
			throw new Error('Azure OpenAI endpoint is not configured.');
		}
		if (!this.apiKey) {
			throw new Error('Azure OpenAI API key is not configured.');
		}
		if (!this.deploymentName) {
			throw new Error('Azure OpenAI deployment name is not configured.');
		}
	}

	protected validateChatConfig(): void {
		if (!this.endpoint) {
			throw new Error('Azure OpenAI endpoint is not configured.');
		}
		if (!this.apiKey) {
			throw new Error('Azure OpenAI API key is not configured.');
		}
		if (!this.deploymentName) {
			throw new Error('Azure OpenAI deployment name is not configured.');
		}
	}

	protected buildChatRequestBody(messages: ChatMessage[], options: ChatOptions): Record<string, unknown> {
		// Azure OpenAI doesn't need the model field in the body (it's in the URL)
		const body: Record<string, unknown> = {
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
}

