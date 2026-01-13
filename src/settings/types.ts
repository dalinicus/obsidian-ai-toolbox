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
 * Prompt source type options for workflows
 */
export type PromptSourceType = 'inline' | 'from-file';

/**
 * Workflow type options
 */
export type WorkflowType = 'chat' | 'transcription';

/**
 * Media type for transcription context
 */
export type TranscriptionMediaType = 'video' | 'audio';

/**
 * Timestamp granularity for transcription output.
 * - 'disabled': No timestamps (uses simpler JSON format, reduces token usage)
 * - 'segment': Timestamps at sentence/phrase level
 * - 'word': Timestamps at individual word level
 */
export type TimestampGranularity = 'disabled' | 'segment' | 'word';

/**
 * Context configuration for transcription workflows
 */
export interface TranscriptionContextConfig {
	mediaType: TranscriptionMediaType;
	/** Token name to resolve for the source URL (e.g., 'workflow.clipboard', 'chat1.response') */
	sourceUrlToken?: string;
}

/**
 * Available context types for chat workflows
 */
export type ChatContextType = 'selection' | 'active-tab' | 'clipboard';

/**
 * Configuration for a context source in a chat workflow
 */
export interface ChatContextConfig {
	/** Unique identifier for this context instance */
	id: string;
	/** The type of context */
	type: ChatContextType;
}



/**
 * Action type options - determines what kind of operation an action performs
 */
export type ActionType = 'chat' | 'transcription';

/**
 * Base action interface with common properties for all action types
 */
export interface BaseAction {
	/** Unique identifier for this action */
	id: string;
	/** The type of action */
	type: ActionType;
	/** Display name for this action */
	name: string;
	/** Provider and model to use for this action */
	provider: ProviderModelSelection | null;
}

/**
 * Chat action configuration - sends a prompt to an AI model
 */
export interface ChatAction extends BaseAction {
	type: 'chat';
	/** The prompt text to send */
	promptText: string;
	/** Where the prompt comes from */
	promptSourceType: PromptSourceType;
	/** Path to prompt file (when promptSourceType is 'from-file') */
	promptFilePath: string;
	/** Context sources for this chat action */
	contexts?: ChatContextConfig[];
}

/**
 * Transcription action configuration - transcribes audio/video
 */
export interface TranscriptionAction extends BaseAction {
	type: 'transcription';
	/** Transcription context (media type and source) */
	transcriptionContext?: TranscriptionContextConfig;
	/** Language for transcription */
	language?: string;
	/** Timestamp granularity setting */
	timestampGranularity?: TimestampGranularity;
}

/**
 * Union type for all action types
 */
export type WorkflowAction = ChatAction | TranscriptionAction;

/**
 * Default configuration for a new chat action
 */
export const DEFAULT_CHAT_ACTION: Omit<ChatAction, 'id'> = {
	type: 'chat',
	name: 'Chat',
	provider: null,
	promptText: '',
	promptSourceType: 'inline',
	promptFilePath: '',
	contexts: []
};

/**
 * Default configuration for a new transcription action
 */
export const DEFAULT_TRANSCRIPTION_ACTION: Omit<TranscriptionAction, 'id'> = {
	type: 'transcription',
	name: 'Transcription',
	provider: null,
	transcriptionContext: { mediaType: 'video', sourceUrlToken: 'workflow.clipboard' },
	language: '',
	timestampGranularity: 'disabled'
};

/**
 * Configuration for a custom workflow - a container for sequential actions
 */
export interface WorkflowConfig {
	/** Unique identifier for this workflow */
	id: string;
	/** Display name for this workflow */
	name: string;
	/** Sequential list of actions to execute */
	actions: WorkflowAction[];
	/** How to display the final output */
	outputType: WorkflowOutputType;
	/** Folder for output (when outputType is 'new-note') */
	outputFolder: string;
	/** Whether to show this workflow as a command in the command palette */
	showInCommandPalette: boolean;
}

/**
 * Default configuration for a new workflow
 */
export const DEFAULT_WORKFLOW_CONFIG: Omit<WorkflowConfig, 'id'> = {
	name: 'New workflow',
	actions: [],
	outputType: 'popup',
	outputFolder: '',
	showInCommandPalette: false
};

export interface AIToolboxSettings {
	impersonateBrowser: string;
	cookiesFromBrowser: string;
	ytdlpLocation: string;
	ffmpegLocation: string;
	outputDirectory: string;
	keepVideo: boolean;
	// Provider-based settings
	providers: AIProviderConfig[];
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
	cookiesFromBrowser: '',
	ytdlpLocation: '',
	ffmpegLocation: '',
	outputDirectory: '',
	keepVideo: false,
	providers: [],
	workflows: []
}

/**
 * Supported settings tab types
 */
export type SettingsTabType = 'providers' | 'workflows' | 'settings';

/**
 * State for tracking which items should be expanded on next render
 */
export interface ExpandOnNextRenderState {
	providerId?: string;
	modelId?: string;
	workflowId?: string;
	actionId?: string;
	availableTokensExpanded?: boolean;
}

