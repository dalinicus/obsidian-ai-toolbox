/**
 * Manages delete mode state for a collection of entities.
 * Provides a centralized way to track whether delete mode is enabled
 * for different entity types (workflows, actions, providers, models).
 */
export class DeleteModeManager {
	private deleteStates: Map<string, boolean> = new Map();

	/**
	 * Get delete mode state for an entity
	 * @param entityId - The unique identifier for the entity (e.g., workflow ID for actions)
	 * @returns Whether delete mode is enabled
	 */
	get(entityId: string): boolean {
		return this.deleteStates.get(entityId) ?? false;
	}

	/**
	 * Set delete mode state for an entity
	 * @param entityId - The unique identifier for the entity
	 * @param enabled - Whether delete mode should be enabled
	 */
	set(entityId: string, enabled: boolean): void {
		this.deleteStates.set(entityId, enabled);
	}

	/**
	 * Toggle delete mode state for an entity
	 * @param entityId - The unique identifier for the entity
	 * @returns The new delete mode state
	 */
	toggle(entityId: string): boolean {
		const newState = !this.get(entityId);
		this.set(entityId, newState);
		return newState;
	}

	/**
	 * Clear delete mode state for an entity
	 * @param entityId - The unique identifier for the entity
	 */
	clear(entityId: string): void {
		this.deleteStates.delete(entityId);
	}

	/**
	 * Clear all delete mode states
	 */
	clearAll(): void {
		this.deleteStates.clear();
	}
}

// Global manager for top-level entity delete modes (workflows, providers)
export const globalDeleteModeManager = new DeleteModeManager();

// Global manager for nested entity delete modes (actions within workflows, models within providers)
export const nestedDeleteModeManager = new DeleteModeManager();

