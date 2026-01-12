import { MarkdownView } from 'obsidian';
import { OutputHandler, OutputContext } from './types';
import { logNotice, LogCategory } from '../../logging';

/**
 * Output handler that inserts the AI response at the current cursor position
 * or replaces selected text in the active Obsidian editor.
 */
export class AtCursorOutputHandler implements OutputHandler {
    async handleOutput(responseText: string, context: OutputContext): Promise<void> {
        const activeView = context.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            logNotice(LogCategory.WORKFLOW, 'No active editor. Please open a note first.');
            return;
        }

        const editor = activeView.editor;
        const hasSelection = editor.somethingSelected();

        if (hasSelection) {
            const from = editor.getCursor('from');
            editor.replaceSelection(responseText);
            this.moveCursorToEndOfText(editor, from, responseText);
            logNotice(LogCategory.WORKFLOW, 'Response replaced selection');
        } else {
            const cursor = editor.getCursor();
            editor.replaceRange(responseText, cursor);
            this.moveCursorToEndOfText(editor, cursor, responseText);
            logNotice(LogCategory.WORKFLOW, 'Response inserted at cursor');
        }
    }

    private moveCursorToEndOfText(
        editor: MarkdownView['editor'],
        startPos: { line: number; ch: number },
        text: string
    ): void {
        const lines = text.split('\n');
        const lastLine = lines[lines.length - 1] ?? '';
        const newLine = startPos.line + lines.length - 1;
        const newCh = lines.length === 1 ? startPos.ch + lastLine.length : lastLine.length;
        editor.setCursor({ line: newLine, ch: newCh });
    }
}

