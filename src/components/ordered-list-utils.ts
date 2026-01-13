/**
 * Options for move operations
 */
export interface MoveOptions<T> {
	/** The array of items */
	items: T[];
	/** Current index of the item to move */
	index: number;
}

/**
 * Result of a move operation
 */
export interface MoveResult {
	/** Whether the move was successful */
	success: boolean;
	/** The new index after moving (same as original if not successful) */
	newIndex: number;
}

/**
 * Move an item up in an array (toward index 0)
 * @param options - Move options containing the items array and current index
 * @returns Result indicating success and new index
 */
export function moveItemUp<T>(options: MoveOptions<T>): MoveResult {
	const { items, index } = options;
	
	if (index <= 0 || index >= items.length) {
		return { success: false, newIndex: index };
	}
	
	const temp = items[index - 1];
	const current = items[index];
	if (temp !== undefined && current !== undefined) {
		items[index - 1] = current;
		items[index] = temp;
		return { success: true, newIndex: index - 1 };
	}
	
	return { success: false, newIndex: index };
}

/**
 * Move an item down in an array (toward higher index)
 * @param options - Move options containing the items array and current index
 * @returns Result indicating success and new index
 */
export function moveItemDown<T>(options: MoveOptions<T>): MoveResult {
	const { items, index } = options;
	
	if (index < 0 || index >= items.length - 1) {
		return { success: false, newIndex: index };
	}
	
	const temp = items[index + 1];
	const current = items[index];
	if (temp !== undefined && current !== undefined) {
		items[index + 1] = current;
		items[index] = temp;
		return { success: true, newIndex: index + 1 };
	}
	
	return { success: false, newIndex: index };
}

/**
 * Check if an item can be moved up
 * @param index - Current index of the item
 * @returns Whether the item can be moved up
 */
export function canMoveUp(index: number): boolean {
	return index > 0;
}

/**
 * Check if an item can be moved down
 * @param index - Current index of the item
 * @param arrayLength - Total length of the array
 * @returns Whether the item can be moved down
 */
export function canMoveDown(index: number, arrayLength: number): boolean {
	return index < arrayLength - 1;
}

/**
 * Configuration for creating move handlers for collapsible sections
 */
export interface CreateMoveHandlersConfig<T> {
	/** The array of items */
	items: T[];
	/** Current index of the item */
	index: number;
	/** Whether delete mode is currently active (hides move buttons when true) */
	isDeleteMode: boolean;
	/** Callback to save settings after move */
	saveSettings: () => Promise<void>;
	/** Callback to preserve expand state before refresh */
	preserveExpandState: () => void;
	/** Callback to refresh the UI */
	refresh: () => void;
}

/**
 * Create move up/down handlers for a collapsible section
 * Returns undefined for handlers that should not be shown
 */
export function createMoveHandlers<T>(
	config: CreateMoveHandlersConfig<T>
): { onMoveUp?: () => Promise<void>; onMoveDown?: () => Promise<void> } {
	const { items, index, isDeleteMode, saveSettings, preserveExpandState, refresh } = config;

	if (isDeleteMode) {
		return {};
	}

	const onMoveUp = canMoveUp(index) ? async () => {
		moveItemUp({ items, index });
		await saveSettings();
		preserveExpandState();
		refresh();
	} : undefined;

	const onMoveDown = canMoveDown(index, items.length) ? async () => {
		moveItemDown({ items, index });
		await saveSettings();
		preserveExpandState();
		refresh();
	} : undefined;

	return { onMoveUp, onMoveDown };
}

