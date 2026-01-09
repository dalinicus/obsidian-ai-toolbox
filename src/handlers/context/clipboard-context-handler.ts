import { ContextHandler, ContextHandlerContext, ContextResult, ChatContextType } from './types';
import { TokenDefinition } from '../../tokens';

/**
 * Context handler that retrieves the current clipboard contents.
 */
export class ClipboardContextHandler implements ContextHandler {
    readonly contextType: ChatContextType = 'clipboard';

    getAvailableTokens(): TokenDefinition[] {
        return [
            {
                name: 'clipboard',
                description: 'The current contents of the system clipboard'
            }
        ];
    }

    async getContent(_context: ContextHandlerContext): Promise<ContextResult> {
        try {
            const clipboardText = await navigator.clipboard.readText();

            if (!clipboardText || !clipboardText.trim()) {
                return {
                    content: '',
                    success: false,
                    error: 'Clipboard is empty or contains no text.'
                };
            }

            return {
                content: clipboardText,
                success: true
            };
        } catch (error) {
            return {
                content: '',
                success: false,
                error: `Failed to read clipboard: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}

