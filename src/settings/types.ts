/**
 * Default OpenAI API endpoint
 */
export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1';

/**
 * Supported AI provider types
 */
export type AIProviderType = 'azure-openai' | 'openai' | 'anthropic';

/**
 * Model configuration for a provider
 */
export interface AIModelConfig {
	id: string;
	name: string;
	deploymentName: string; // Used by Azure, can be same as model ID for other providers
	modelId: string;
	supportsChat?: boolean; // Whether this model supports chat/conversation
	supportsTranscription?: boolean; // Whether this model supports audio transcription
}

/**
 * AI Provider configuration
 */
export interface AIProviderConfig {
	id: string;
	name: string;
	type: AIProviderType;
	endpoint: string;
	apiKey: string;
	models: AIModelConfig[];
}

/**
 * Reference to a specific provider and model for a feature
 */
export interface ProviderModelSelection {
	providerId: string;
	modelId: string;
}

/**
 * Output type options for prompt execution
 */
export type PromptOutputType = 'popup' | 'new-note' | 'at-cursor';

/**
 * Configuration for a custom prompt
 */
export interface PromptConfig {
	id: string;
	name: string;
	promptText: string;
	provider: ProviderModelSelection | null;
	outputType: PromptOutputType;
}

/**
 * Default configuration for a new prompt
 */
export const DEFAULT_PROMPT_CONFIG: Omit<PromptConfig, 'id'> = {
	name: 'New prompt',
	promptText: '',
	provider: null,
	outputType: 'popup'
};

export interface AIToolboxSettings {
	impersonateBrowser: string;
	ytdlpLocation: string;
	ffmpegLocation: string;
	outputDirectory: string;
	keepVideo: boolean;
	includeTimestamps: boolean;
	transcriptionLanguage: string;
	outputFolder: string;
	// New provider-based settings
	providers: AIProviderConfig[];
	transcriptionProvider: ProviderModelSelection | null;
	// Custom prompts
	prompts: PromptConfig[];
}

/**
 * Generate a unique ID for providers and models
 */
export function generateId(): string {
	return Math.random().toString(36).substring(2, 11);
}

export const DEFAULT_SETTINGS: AIToolboxSettings = {
	impersonateBrowser: 'chrome',
	ytdlpLocation: '',
	ffmpegLocation: '',
	outputDirectory: '',
	keepVideo: false,
	includeTimestamps: true,
	transcriptionLanguage: '',
	outputFolder: '',
	providers: [],
	transcriptionProvider: null,
	prompts: []
}

/**
 * Supported settings tab types
 */
export type SettingsTabType = 'providers' | 'prompts' | 'transcription';

/**
 * State for tracking which items should be expanded on next render
 */
export interface ExpandOnNextRenderState {
	providerId?: string;
	modelId?: string;
	promptId?: string;
}

