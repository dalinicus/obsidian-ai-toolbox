import { MarkdownView, Notice } from 'obsidian';
import { OutputHandler, OutputContext } from './types';

/**
 * Output handler that inserts the AI response at the current cursor position
 * in the active Obsidian editor.
 */
export class AtCursorOutputHandler implements OutputHandler {
    async handleOutput(responseText: string, context: OutputContext): Promise<void> {
        const activeView = context.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('No active editor. Please open a note first.');
            return;
        }

        const editor = activeView.editor;
        const cursor = editor.getCursor();
        editor.replaceRange(responseText, cursor);

        // Move cursor to end of inserted text
        const lines = responseText.split('\n');
        const lastLine = lines[lines.length - 1] ?? '';
        const newLine = cursor.line + lines.length - 1;
        const newCh = lines.length === 1 ? cursor.ch + lastLine.length : lastLine.length;
        editor.setCursor({ line: newLine, ch: newCh });

        new Notice('Response inserted at cursor');
    }
}

