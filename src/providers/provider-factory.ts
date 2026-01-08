import { AIToolboxSettings, AIProviderConfig, AIModelConfig, DEFAULT_OPENAI_ENDPOINT, WorkflowConfig, ProviderModelSelection } from '../settings/index';
import { ModelProvider, ModelProviderConfig } from './types';
import { AzureOpenAIModelProvider } from './azure-openai-provider';
import { OpenAIModelProvider } from './openai-provider';

/**
 * Error thrown when a model provider cannot be created
 */
export class ProviderCreationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ProviderCreationError';
	}
}

/**
 * Build a ModelProviderConfig from provider and model settings.
 */
function buildProviderConfig(provider: AIProviderConfig, model: AIModelConfig): ModelProviderConfig {
	// Use default OpenAI endpoint if not configured
	const endpoint = provider.endpoint || (provider.type === 'openai' ? DEFAULT_OPENAI_ENDPOINT : '');

	return {
		id: provider.id,
		name: provider.name,
		modelDisplayName: model.name,
		type: provider.type,
		endpoint: endpoint,
		apiKey: provider.apiKey,
		modelId: model.modelId,
		deploymentName: model.deploymentName || model.modelId,
		supportsChat: model.supportsChat,
		supportsTranscription: model.supportsTranscription,
	};
}

/**
 * Create a ModelProvider instance based on provider type.
 *
 * @param config - The model provider configuration
 * @returns A configured ModelProvider instance
 * @throws ProviderCreationError if the provider type is not supported
 */
export function createModelProvider(config: ModelProviderConfig): ModelProvider {
	switch (config.type) {
		case 'azure-openai':
			return new AzureOpenAIModelProvider(config);
		case 'openai':
			return new OpenAIModelProvider(config);
		case 'anthropic':
			throw new ProviderCreationError(`Anthropic model provider is not yet implemented.`);
		default:
			throw new ProviderCreationError(`Unknown provider type: ${config.type as string}`);
	}
}

/**
 * Create a provider from a ProviderModelSelection.
 *
 * @param settings - Plugin settings containing provider configuration
 * @param selection - The provider/model selection
 * @returns A configured ModelProvider, or null if not found
 * @throws ProviderCreationError if the provider cannot be created
 */
function createProviderFromSelection(settings: AIToolboxSettings, selection: ProviderModelSelection): ModelProvider | null {
	const provider = settings.providers.find(p => p.id === selection.providerId);
	if (!provider) {
		return null;
	}

	const model = provider.models.find(m => m.id === selection.modelId);
	if (!model) {
		return null;
	}

	const config = buildProviderConfig(provider, model);
	return createModelProvider(config);
}

/**
 * Create a transcription provider from settings.
 *
 * @param settings - Plugin settings containing provider configuration
 * @returns A configured ModelProvider for transcription, or null if not configured
 * @throws ProviderCreationError if the provider cannot be created
 */
export function createTranscriptionProvider(settings: AIToolboxSettings): ModelProvider | null {
	const selection = settings.transcriptionProvider;
	if (!selection) {
		return null;
	}

	return createProviderFromSelection(settings, selection);
}

/**
 * Create a provider for a specific workflow configuration.
 *
 * @param settings - Plugin settings containing provider configuration
 * @param workflow - The workflow configuration to create a provider for
 * @returns A configured ModelProvider for the workflow, or null if not configured
 * @throws ProviderCreationError if the provider cannot be created
 */
export function createWorkflowProvider(settings: AIToolboxSettings, workflow: WorkflowConfig): ModelProvider | null {
	if (!workflow.provider) {
		return null;
	}

	return createProviderFromSelection(settings, workflow.provider);
}
