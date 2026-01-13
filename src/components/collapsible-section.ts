import { Setting, setIcon } from "obsidian";

/**
 * Configuration options for creating a collapsible section
 */
export interface CollapsibleSectionConfig {
	/** Container element where the section will be created */
	containerEl: HTMLElement;
	/** Display name for the section header */
	title: string;
	/** CSS class for the main container (e.g., 'provider-container', 'workflow-container') */
	containerClass: string;
	/** CSS class for the content area (e.g., 'provider-content', 'workflow-content') */
	contentClass: string;
	/** CSS class for the header (e.g., 'provider-header', 'workflow-header') */
	headerClass: string;
	/** Whether this section should start expanded */
	startExpanded: boolean;
	/** Whether to show as a heading (bold) - defaults to true */
	isHeading?: boolean;
	/** Optional icon(s) to display after the title - can be a single icon or array of icons */
	icons?: string[];
	/** Optional secondary text to display in the header (e.g., ID) */
	secondaryText?: string;
	/** Callback when the delete button is clicked (if provided, delete button is shown) */
	onDelete?: () => void | Promise<void>;
	/** Callback when the title changes (for dynamic name updates) */
	onTitleChange?: (newTitle: string) => void;
	/** Callback when the move up button is clicked (if provided, move up button is shown) */
	onMoveUp?: () => void | Promise<void>;
	/** Callback when the move down button is clicked (if provided, move down button is shown) */
	onMoveDown?: () => void | Promise<void>;
}

/**
 * Result from creating a collapsible section
 */
export interface CollapsibleSectionResult {
	/** The main container element */
	container: HTMLElement;
	/** The collapsible content container (add your content here) */
	contentContainer: HTMLElement;
	/** The header setting element */
	headerSetting: Setting;
	/** Update the displayed title (with arrow indicator) */
	updateTitle: (newTitle: string) => void;
	/** Check if the section is currently expanded */
	isExpanded: () => boolean;
}

/**
 * Creates a collapsible section with consistent styling and behavior.
 * Handles expand/collapse toggle, arrow icons, and optional delete button.
 */
export function createCollapsibleSection(config: CollapsibleSectionConfig): CollapsibleSectionResult {
	const {
		containerEl,
		title,
		containerClass,
		contentClass,
		headerClass,
		startExpanded,
		isHeading = true,
		icons,
		secondaryText,
		onDelete,
		onMoveUp,
		onMoveDown,
	} = config;

	const container = containerEl.createDiv(containerClass);

	// Create content container first (will be moved after header)
	const contentContainer = container.createDiv(
		`${contentClass} ${startExpanded ? 'is-expanded' : 'is-collapsed'}`
	);

	// Track current title for updates
	let currentTitle = title;
	let iconElements: HTMLElement[] = [];

	// Helper to get the formatted title with arrow and optional icon
	const getFormattedTitle = (name: string, expanded: boolean): string => {
		// Arrow only, icons will be inserted separately
		return `${expanded ? '▾' : '▸'} ${name || 'Unnamed'}`;
	};

	// Create header with collapse toggle
	const headerSetting = new Setting(container)
		.setName(getFormattedTitle(title, startExpanded));

	if (isHeading) {
		headerSetting.setHeading();
	}

	// Add icons if provided (at the end, after title text)
	if (icons && icons.length > 0) {
		for (const iconName of icons) {
			const iconElement = headerSetting.nameEl.createSpan({ cls: 'workflow-header-icon' });
			setIcon(iconElement, iconName);
			headerSetting.nameEl.appendChild(iconElement);
			iconElements.push(iconElement);
		}
	}

	// Add secondary text if provided (displayed before delete button)
	if (secondaryText) {
		const secondaryEl = headerSetting.controlEl.createSpan({ cls: 'collapsible-section-secondary-text' });
		secondaryEl.textContent = secondaryText;
	}

	// Add move up button if callback provided
	if (onMoveUp) {
		headerSetting.addButton(button => button
			.setIcon('chevron-up')
			.setTooltip('Move up')
			.onClick(() => { void onMoveUp(); }));
	}

	// Add move down button if callback provided
	if (onMoveDown) {
		headerSetting.addButton(button => button
			.setIcon('chevron-down')
			.setTooltip('Move down')
			.onClick(() => { void onMoveDown(); }));
	}

	// Add delete button if callback provided
	if (onDelete) {
		headerSetting.addButton(button => button
			.setIcon('trash')
			.setTooltip('Delete')
			.onClick(() => { void onDelete(); }));
	}

	headerSetting.settingEl.addClass(headerClass);

	// Toggle function
	const toggleCollapse = () => {
		const isCollapsed = contentContainer.classList.contains('is-collapsed');
		contentContainer.classList.toggle('is-collapsed', !isCollapsed);
		contentContainer.classList.toggle('is-expanded', isCollapsed);
		headerSetting.setName(getFormattedTitle(currentTitle, isCollapsed));

		// Re-add icons at the end
		for (const iconElement of iconElements) {
			headerSetting.nameEl.appendChild(iconElement);
		}
	};

	// Add click handler to header (excluding buttons)
	headerSetting.settingEl.addEventListener('click', (e) => {
		if (!(e.target as HTMLElement).closest('button')) {
			toggleCollapse();
		}
	});

	// Move content container after header
	container.appendChild(contentContainer);

	// Update title function
	const updateTitle = (newTitle: string) => {
		currentTitle = newTitle;
		const isExpanded = contentContainer.classList.contains('is-expanded');
		headerSetting.setName(getFormattedTitle(newTitle, isExpanded));

		// Re-add icons at the end
		for (const iconElement of iconElements) {
			headerSetting.nameEl.appendChild(iconElement);
		}
	};

	// Check if expanded
	const isExpanded = () => contentContainer.classList.contains('is-expanded');

	return {
		container,
		contentContainer,
		headerSetting,
		updateTitle,
		isExpanded,
	};
}

