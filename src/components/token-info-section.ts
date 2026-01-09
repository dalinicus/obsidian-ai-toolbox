import { setIcon } from "obsidian";
import { TokenDefinition } from "../tokens";

/**
 * Configuration for creating a token info section
 */
export interface TokenInfoSectionConfig {
	/** Container element where the section will be created */
	containerEl: HTMLElement;
	/** The workflow ID to use in token references */
	workflowId: string;
	/** Token definitions to display */
	tokens: TokenDefinition[];
	/** Whether the section should start expanded */
	startExpanded?: boolean;
}

/**
 * Creates a collapsible info section displaying available tokens for a workflow.
 * Styled as a yellow post-it note with informational content.
 */
export function createTokenInfoSection(config: TokenInfoSectionConfig): HTMLElement {
	const {
		containerEl,
		workflowId,
		tokens,
		startExpanded = false
	} = config;

	const sectionContainer = containerEl.createDiv('token-info-section');
	
	// Create header with collapse toggle
	const header = sectionContainer.createDiv('token-info-header');

	const headerIcon = header.createSpan('token-info-header-icon');
	setIcon(headerIcon, 'lightbulb');

	const headerArrow = header.createSpan('token-info-arrow');
	headerArrow.textContent = startExpanded ? '▾' : '▸';

	const headerTitle = header.createSpan('token-info-title');
	headerTitle.textContent = 'Available tokens for use in other workflows';
	
	// Create collapsible content
	const content = sectionContainer.createDiv('token-info-content');
	content.addClass(startExpanded ? 'is-expanded' : 'is-collapsed');
	
	// Add description text
	const description = content.createEl('p', { cls: 'token-info-description' });
	description.textContent = 'This workflow makes the following tokens available for use in templates and prompts.';
	
	// Create token list
	const tokenList = content.createEl('ul', { cls: 'token-info-list' });
	
	for (const token of tokens) {
		const listItem = tokenList.createEl('li', { cls: 'token-info-item' });
		
		const tokenRef = listItem.createEl('code', { cls: 'token-info-reference' });
		tokenRef.textContent = `{{${workflowId}.${token.name}}}`;
		
		const tokenDesc = listItem.createSpan('token-info-token-description');
		tokenDesc.textContent = ` — ${token.description}`;
	}
	
	// Toggle handler
	const toggleContent = () => {
		const isCollapsed = content.classList.contains('is-collapsed');
		content.classList.toggle('is-collapsed', !isCollapsed);
		content.classList.toggle('is-expanded', isCollapsed);
		headerArrow.textContent = isCollapsed ? '▾' : '▸';
	};
	
	header.addEventListener('click', toggleContent);
	
	return sectionContainer;
}

