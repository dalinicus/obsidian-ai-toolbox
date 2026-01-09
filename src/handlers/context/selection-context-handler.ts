import { MarkdownView } from 'obsidian';
import { ContextHandler, ContextHandlerContext, ContextResult, ChatContextType } from './types';
import { TokenDefinition } from '../../tokens';

/**
 * Context handler that retrieves the current text selection in the editor.
 */
export class SelectionContextHandler implements ContextHandler {
    readonly contextType: ChatContextType = 'selection';

    getAvailableTokens(): TokenDefinition[] {
        return [
            {
                name: 'selection',
                description: 'The currently selected text in the editor'
            }
        ];
    }

    async getContent(context: ContextHandlerContext): Promise<ContextResult> {
        const activeView = context.app.workspace.getActiveViewOfType(MarkdownView);

        if (!activeView) {
            return {
                content: '',
                success: false,
                error: 'No active editor. Please open a note and select some text.'
            };
        }

        const editor = activeView.editor;
        const selection = editor.getSelection();

        if (!selection || !selection.trim()) {
            return {
                content: '',
                success: false,
                error: 'No text selected. Please select some text in the editor.'
            };
        }

        return {
            content: selection,
            success: true
        };
    }
}

