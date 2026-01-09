import { WorkflowType } from "../settings/types";

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
	/** The full transcription text */
	transcription: string;
	/** The original video URL */
	sourceUrl: string;
	/** The video description */
	description: string;
}

/**
 * Token definitions for chat workflows
 */
export const CHAT_WORKFLOW_TOKENS: TokenDefinition[] = [
	{ name: 'response', description: 'The AI response text' },
	{ name: 'prompt', description: 'The original prompt text' },
	{ name: 'timestamp', description: 'When the workflow was executed' }
];

/**
 * Token definitions for transcription workflows
 */
export const TRANSCRIPTION_WORKFLOW_TOKENS: TokenDefinition[] = [
	{ name: 'author', description: 'The author/uploader of the video' },
	{ name: 'title', description: 'The title of the video' },
	{ name: 'transcription', description: 'The full transcription text' },
	{ name: 'sourceUrl', description: 'The original video URL' },
	{ name: 'description', description: 'The video description' }
];

/**
 * Get token definitions for a workflow type
 */
export function getTokenDefinitionsForType(type: WorkflowType): TokenDefinition[] {
	return type === 'transcription'
		? TRANSCRIPTION_WORKFLOW_TOKENS
		: CHAT_WORKFLOW_TOKENS;
}

/**
 * Get token definitions for a workflow used as a context source.
 * Returns tokens prefixed with the workflow ID to avoid collisions.
 *
 * @param workflowId - The ID of the workflow
 * @param workflowType - The type of the workflow (chat or transcription)
 */
export function getWorkflowContextTokens(
	workflowId: string,
	workflowType: WorkflowType
): TokenDefinition[] {
	const baseTokens = getTokenDefinitionsForType(workflowType);

	return baseTokens.map(token => ({
		name: `${workflowId}.${token.name}`,
		description: token.description
	}));
}

