import { ActionType, TimestampGranularity } from "../settings/types";

/**
 * Token definition for display in the settings UI
 */
export interface TokenDefinition {
	/** The token name (e.g., 'response', 'transcription') */
	name: string;
	/** Human-readable description of what the token contains */
	description: string;
}

/**
 * Base workflow token model with shared fields across all workflow types
 */
export interface BaseWorkflowTokens {
	/** When the workflow was executed (ISO timestamp) */
	timestamp: string;
}

/**
 * Token model for chat workflows
 */
export interface ChatWorkflowTokens extends BaseWorkflowTokens {
	/** The AI response text */
	response: string;
	/** The original prompt text */
	prompt: string;
}

/**
 * Token model for transcription workflows
 */
export interface TranscriptionWorkflowTokens {
	/** The author/uploader of the video */
	author: string;
	/** The title of the video */
	title: string;
	/** The full transcription text (plain text without timestamps) */
	transcription: string;
	/** The transcription with timestamps (formatted with [MM:SS] prefixes) */
	transcriptionWithTimestamps: string;
	/** The original video URL */
	sourceUrl: string;
	/** The video description */
	description: string;
	/** The video tags (comma-separated) */
	tags: string;
}

/**
 * Token definitions for chat workflows (ordered for template generation)
 */
export const CHAT_WORKFLOW_TOKENS: TokenDefinition[] = [
	{ name: 'prompt', description: 'The original prompt text' },
	{ name: 'response', description: 'The AI response text' }
];

/**
 * Token definitions for transcription workflows (ordered for template generation)
 */
export const TRANSCRIPTION_WORKFLOW_TOKENS: TokenDefinition[] = [
	{ name: 'title', description: 'The title of the video' },
	{ name: 'author', description: 'The author/uploader of the video' },
	{ name: 'sourceUrl', description: 'The original video URL' },
	{ name: 'description', description: 'The video description' },
	{ name: 'tags', description: 'The video tags (comma-separated)' },
	{ name: 'transcription', description: 'The plain transcription text (no timestamps)' },
	{ name: 'transcriptionWithTimestamps', description: 'The transcription with [MM:SS] timestamps' }
];

/**
 * Human-readable labels for token names (used in template generation)
 */
const TOKEN_LABELS: Record<string, string> = {
	prompt: 'Prompt',
	response: 'Response',
	title: 'Title',
	author: 'Author',
	sourceUrl: 'Source URL',
	description: 'Description',
	tags: 'Tags',
	transcription: 'Transcription',
	transcriptionWithTimestamps: 'Transcription (with timestamps)'
};

/**
 * Options for getting token definitions
 */
export interface TokenDefinitionOptions {
	/** For transcription actions, the timestamp granularity setting */
	timestampGranularity?: TimestampGranularity;
}

/**
 * Get token definitions for an action type.
 * For transcription actions, the transcriptionWithTimestamps token is excluded
 * when timestampGranularity is 'disabled' or undefined (default).
 */
export function getTokenDefinitionsForActionType(
	type: ActionType,
	options?: TokenDefinitionOptions
): TokenDefinition[] {
	if (type === 'transcription') {
		const granularity = options?.timestampGranularity ?? 'disabled';
		if (granularity === 'disabled') {
			return TRANSCRIPTION_WORKFLOW_TOKENS.filter(
				token => token.name !== 'transcriptionWithTimestamps'
			);
		}
		return TRANSCRIPTION_WORKFLOW_TOKENS;
	}
	return CHAT_WORKFLOW_TOKENS;
}

/**
 * Get token definitions for an action, prefixed with action ID.
 * Used to show available tokens in the settings UI.
 *
 * @param actionId - The ID of the action
 * @param actionType - The type of the action (chat or transcription)
 * @param options - Optional settings like timestampGranularity
 */
export function getActionTokens(
	actionId: string,
	actionType: ActionType,
	options?: TokenDefinitionOptions
): TokenDefinition[] {
	const baseTokens = getTokenDefinitionsForActionType(actionType, options);

	return baseTokens.map(token => ({
		name: `${actionId}.${token.name}`,
		description: token.description
	}));
}

/**
 * Get token definitions for a workflow used as a context source.
 * Returns tokens from the last action, prefixed with the workflow ID.
 *
 * @param workflowId - The ID of the workflow
 * @param lastActionType - The type of the last action in the workflow
 * @param options - Optional settings like timestampGranularity
 */
export function getWorkflowContextTokens(
	workflowId: string,
	lastActionType: ActionType,
	options?: TokenDefinitionOptions
): TokenDefinition[] {
	const baseTokens = getTokenDefinitionsForActionType(lastActionType, options);

	return baseTokens.map(token => ({
		name: `${workflowId}.${token.name}`,
		description: token.description
	}));
}

/**
 * Generate a formatted template string containing all tokens for a workflow.
 * Used for copying a complete set of token references to the clipboard.
 *
 * @param workflowId - The ID of the workflow
 * @param lastActionType - The type of the last action in the workflow
 * @param options - Optional settings like timestampGranularity
 */
export function generateWorkflowTokenTemplate(
	workflowId: string,
	lastActionType: ActionType,
	options?: TokenDefinitionOptions
): string {
	const tokens = getTokenDefinitionsForActionType(lastActionType, options);

	return tokens
		.map(token => {
			const label = TOKEN_LABELS[token.name] || token.name;
			return `- ${label}: {{${workflowId}.${token.name}}}`;
		})
		.join('\n');
}

