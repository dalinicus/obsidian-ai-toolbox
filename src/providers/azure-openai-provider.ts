import { ModelProviderConfig } from './types';
import { AIProviderType } from '../settings';
import { BaseProvider } from './base-model-provider';

/**
 * Azure OpenAI model provider implementation.
 * Supports transcription using Azure-specific authentication and deployment-based endpoints.
 */
export class AzureOpenAIModelProvider extends BaseProvider {
	readonly type: AIProviderType = 'azure-openai';
	private readonly apiVersion: string;

	constructor(config: ModelProviderConfig) {
		super(config);
	}

	protected buildTranscriptionUrl(): string {
		const endpoint = this.endpoint.replace(/\/$/, '');
		return `${endpoint}/openai/deployments/${this.deploymentName}/audio/transcriptions?api-version=2024-06-01`;
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
}

