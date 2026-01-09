// Context handler types
export type {
    ChatContextType,
    ChatContextConfig,
    ContextHandler,
    ContextHandlerContext,
    ContextResult
} from './types';

export {
    CHAT_CONTEXT_TYPE_LABELS,
    CHAT_CONTEXT_TYPE_DESCRIPTIONS
} from './types';

// Context handler implementations
export { SelectionContextHandler } from './selection-context-handler';
export { ActiveTabContextHandler } from './active-tab-context-handler';
export { ClipboardContextHandler } from './clipboard-context-handler';

import { ChatContextType, ContextHandler } from './types';
import { SelectionContextHandler } from './selection-context-handler';
import { ActiveTabContextHandler } from './active-tab-context-handler';
import { ClipboardContextHandler } from './clipboard-context-handler';

/**
 * Factory function to create a context handler based on context type.
 */
export function createContextHandler(contextType: ChatContextType): ContextHandler {
    switch (contextType) {
        case 'selection':
            return new SelectionContextHandler();
        case 'active-tab':
            return new ActiveTabContextHandler();
        case 'clipboard':
            return new ClipboardContextHandler();
        default:
            throw new Error(`Unknown context type: ${contextType}`);
    }
}

/**
 * Get all available context types.
 */
export function getAvailableContextTypes(): ChatContextType[] {
    return ['selection', 'active-tab', 'clipboard'];
}

