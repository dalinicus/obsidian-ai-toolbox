import { ActionType, TimestampGranularity, WorkflowConfig } from "../settings/types";

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
 * Token definitions for workflow context (available to all actions)
 */
export const WORKFLOW_CONTEXT_TOKENS: TokenDefinition[] = [
	{ name: 'workflow.selection', description: 'The currently selected text in the editor' },
	{ name: 'workflow.clipboard', description: 'The current contents of the system clipboard' },
	{ name: 'workflow.file.content', description: 'The full contents of the active file' },
	{ name: 'workflow.file.path', description: 'The path of the active file' }
];

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
 * Token group for organizing available tokens in the UI
 */
export interface TokenGroup {
	/** Display name for this group */
	name: string;
	/** Tokens in this group */
	tokens: TokenDefinition[];
}

/**
 * Generate a formatted template string for a token group.
 * Format:
 * Group Name
 * - label: {{tokenName}}
 */
export function generateGroupTemplate(group: TokenGroup): string {
	const lines = [group.name];
	for (const token of group.tokens) {
		const tokenName = token.name.split('.').pop() || token.name;
		lines.push(`- ${tokenName}: {{${token.name}}}`);
	}
	return lines.join('\n');
}

/**
 * Get all available tokens for a specific action in a workflow.
 * Returns tokens grouped by source: workflow context and each previous action as its own group.
 *
 * @param workflow - The workflow containing the action
 * @param actionIndex - The index of the action in the workflow
 */
export function getAvailableTokensForAction(
	workflow: WorkflowConfig,
	actionIndex: number
): TokenGroup[] {
	const groups: TokenGroup[] = [];

	// Workflow context tokens (always available)
	groups.push({
		name: 'Workflow Context',
		tokens: WORKFLOW_CONTEXT_TOKENS
	});

	// Each previous action becomes its own top-level group
	const previousActions = workflow.actions.slice(0, actionIndex);
	for (const prevAction of previousActions) {
		const options: TokenDefinitionOptions = {};
		if (prevAction.type === 'transcription') {
			options.timestampGranularity = prevAction.timestampGranularity;
		}
		const tokens = getActionTokens(prevAction.id, prevAction.type, options);
		groups.push({
			name: prevAction.name || `Action ${prevAction.id}`,
			tokens
		});
	}

	return groups;
}
