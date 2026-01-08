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
	/** Optional icon to display before the title */
	icon?: string;
	/** Callback when the delete button is clicked (if provided, delete button is shown) */
	onDelete?: () => void;
	/** Callback when the title changes (for dynamic name updates) */
	onTitleChange?: (newTitle: string) => void;
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
		icon,
		onDelete,
	} = config;

	const container = containerEl.createDiv(containerClass);

	// Create content container first (will be moved after header)
	const contentContainer = container.createDiv(
		`${contentClass} ${startExpanded ? 'is-expanded' : 'is-collapsed'}`
	);

	// Track current title for updates
	let currentTitle = title;
	let iconElement: HTMLElement | null = null;

	// Helper to get the formatted title with arrow and optional icon
	const getFormattedTitle = (name: string, expanded: boolean): string => {
		// Arrow only, icon will be inserted separately
		return `${expanded ? '▾' : '▸'} ${name || 'Unnamed'}`;
	};

	// Create header with collapse toggle
	const headerSetting = new Setting(container)
		.setName(getFormattedTitle(title, startExpanded));

	if (isHeading) {
		headerSetting.setHeading();
	}

	// Add icon if provided (at the end, after title text)
	if (icon) {
		iconElement = headerSetting.nameEl.createSpan({ cls: 'workflow-header-icon' });
		setIcon(iconElement, icon);
		headerSetting.nameEl.appendChild(iconElement);
	}

	// Add delete button if callback provided
	if (onDelete) {
		headerSetting.addButton(button => button
			.setIcon('trash')
			.setTooltip('Delete')
			.onClick(onDelete));
	}

	headerSetting.settingEl.addClass(headerClass);

	// Toggle function
	const toggleCollapse = () => {
		const isCollapsed = contentContainer.classList.contains('is-collapsed');
		contentContainer.classList.toggle('is-collapsed', !isCollapsed);
		contentContainer.classList.toggle('is-expanded', isCollapsed);
		headerSetting.setName(getFormattedTitle(currentTitle, isCollapsed));

		// Re-add icon at the end
		if (icon && iconElement) {
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

		// Re-add icon at the end
		if (icon && iconElement) {
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

