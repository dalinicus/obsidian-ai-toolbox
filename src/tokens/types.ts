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
	{ name: 'transcription', description: 'The full transcription text' }
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
	transcription: 'Transcription'
};

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

/**
 * Generate a formatted template string containing all tokens for a workflow.
 * Used for copying a complete set of token references to the clipboard.
 *
 * @param workflowId - The ID of the workflow
 * @param workflowType - The type of the workflow (chat or transcription)
 */
export function generateWorkflowTokenTemplate(
	workflowId: string,
	workflowType: WorkflowType
): string {
	const tokens = getTokenDefinitionsForType(workflowType);

	return tokens
		.map(token => {
			const label = TOKEN_LABELS[token.name] || token.name;
			return `- ${label}: {{${workflowId}.${token.name}}}`;
		})
		.join('\n');
}

