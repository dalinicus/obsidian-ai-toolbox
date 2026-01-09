import { MarkdownView } from 'obsidian';
import { ContextHandler, ContextHandlerContext, ContextResult, ChatContextType } from './types';
import { TokenDefinition } from '../../tokens';

/**
 * Context handler that retrieves the full contents of the currently active file.
 */
export class ActiveTabContextHandler implements ContextHandler {
    readonly contextType: ChatContextType = 'active-tab';

    getAvailableTokens(): TokenDefinition[] {
        return [
            {
                name: 'activeTabContent',
                description: 'The full contents of the currently active file'
            },
            {
                name: 'activeTabFilename',
                description: 'The filename of the currently active file'
            }
        ];
    }

    async getContent(context: ContextHandlerContext): Promise<ContextResult> {
        const activeView = context.app.workspace.getActiveViewOfType(MarkdownView);

        if (!activeView) {
            return {
                content: '',
                success: false,
                error: 'No active file. Please open a note.'
            };
        }

        const file = activeView.file;
        if (!file) {
            return {
                content: '',
                success: false,
                error: 'No file associated with the active view.'
            };
        }

        try {
            const content = await context.app.vault.read(file);
            return {
                content,
                success: true
            };
        } catch (error) {
            return {
                content: '',
                success: false,
                error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}

