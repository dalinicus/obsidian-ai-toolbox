import { Setting, setIcon } from "obsidian";

/**
 * Configuration for creating an entity list header with delete mode toggle and add button
 */
export interface EntityListHeaderConfig {
	/** Container element where the header will be created */
	containerEl: HTMLElement;
	/** Label for the entities (e.g., 'Workflows', 'Actions', 'Models') */
	label?: string;
	/** Description for the setting */
	description?: string;
	/** Current delete mode state */
	isDeleteMode: boolean;
	/** Callback when delete mode is toggled */
	onDeleteModeChange: (enabled: boolean) => void | Promise<void>;
	/** Text for the add button (e.g., 'Add workflow', 'Add model') */
	addButtonText?: string;
	/** Whether the add button should be CTA styled */
	addButtonCta?: boolean;
	/** Callback when add button is clicked (if not provided, no add button shown) */
	onAdd?: () => void | Promise<void>;
	/** Optional dropdown options for add (alternative to button) */
	addDropdownOptions?: Record<string, string>;
	/** Callback when a dropdown option is selected */
	onDropdownSelect?: (value: string) => void | Promise<void>;
}

/**
 * Creates a header for an entity list with delete mode toggle and add button.
 * This provides a consistent UI pattern for managing collections of entities.
 */
export function createEntityListHeader(config: EntityListHeaderConfig): Setting {
	const {
		containerEl,
		label,
		description,
		isDeleteMode,
		onDeleteModeChange,
		addButtonText,
		addButtonCta = false,
		onAdd,
		addDropdownOptions,
		onDropdownSelect,
	} = config;

	const setting = new Setting(containerEl);
	
	if (label) {
		setting.setName(label);
	}
	if (description) {
		setting.setDesc(description);
	}

	// Add delete mode toggle with trash icon
	setting.addToggle(toggle => {
		toggle
			.setValue(isDeleteMode)
			.setTooltip(isDeleteMode ? 'Exit delete mode' : 'Enter delete mode')
			.onChange(async (value) => {
				await onDeleteModeChange(value);
			});

		// Create a custom label with trash icon before the toggle
		const toggleContainer = toggle.toggleEl.parentElement;
		if (toggleContainer) {
			const labelContainer = toggleContainer.createDiv({ cls: 'delete-mode-toggle-label' });
			const iconSpan = labelContainer.createSpan({ cls: 'delete-mode-toggle-icon' });
			setIcon(iconSpan, 'trash');
			// Move the label before the toggle element
			toggleContainer.insertBefore(labelContainer, toggle.toggleEl);
		}
	});

	// Add dropdown if options provided
	if (addDropdownOptions && onDropdownSelect) {
		setting.addDropdown(dropdown => dropdown
			.addOption('', 'Add...')
			.addOptions(addDropdownOptions)
			.onChange(async (value) => {
				if (value) {
					await onDropdownSelect(value);
				}
			}));
	}

	// Add button if callback provided
	if (onAdd && addButtonText) {
		setting.addButton(button => {
			button.setButtonText(addButtonText);
			if (addButtonCta) {
				button.setCta();
			}
			button.onClick(async () => {
				await onAdd();
			});
		});
	}

	return setting;
}

