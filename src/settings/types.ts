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
 * Output type options for workflow execution
 */
export type WorkflowOutputType = 'popup' | 'new-note' | 'at-cursor';

/**
 * Configuration for a custom workflow
 */
export interface WorkflowConfig {
	id: string;
	name: string;
	promptText: string;
	provider: ProviderModelSelection | null;
	outputType: WorkflowOutputType;
	outputFolder: string;
	showInCommand: boolean;
	availableAsInput: boolean;
}

/**
 * Default configuration for a new workflow
 */
export const DEFAULT_WORKFLOW_CONFIG: Omit<WorkflowConfig, 'id'> = {
	name: 'New workflow',
	promptText: '',
	provider: null,
	outputType: 'popup',
	outputFolder: '',
	showInCommand: true,
	availableAsInput: false
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
	// Custom workflows
	workflows: WorkflowConfig[];
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
	workflows: []
}

/**
 * Supported settings tab types
 */
export type SettingsTabType = 'providers' | 'workflows' | 'transcription';

/**
 * State for tracking which items should be expanded on next render
 */
export interface ExpandOnNextRenderState {
	providerId?: string;
	modelId?: string;
	workflowId?: string;
}

