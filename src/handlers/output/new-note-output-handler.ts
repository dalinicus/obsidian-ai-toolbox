import { TFile } from 'obsidian';
import { OutputHandler, OutputContext } from './types';
import { generateFilenameTimestamp } from '../../utils/date-utils';
import { logNotice, LogCategory } from '../../logging';

/**
 * Output handler that creates a new note containing the AI response.
 * The note contains only the raw response text with no additional formatting.
 */
export class NewNoteOutputHandler implements OutputHandler {
    async handleOutput(responseText: string, context: OutputContext): Promise<void> {
        const { app, workflow } = context;

        const timestamp = generateFilenameTimestamp();
        const noteTitle = context.noteTitle || `${workflow.name} - ${timestamp}`;

        // Determine folder path: use workflow-specific folder if set, otherwise fall back to Obsidian's default
        let folderPath: string | undefined;
        if (workflow.outputFolder && workflow.outputFolder.trim() !== '') {
            folderPath = workflow.outputFolder.trim().replace(/\/$/, '');
        } else {
            // Get the default new note location from Obsidian's vault config
            const vault = app.vault as { getConfig?: (key: string) => string | undefined };
            const newFileFolderPath = vault.getConfig?.('newFileFolderPath');
            if (newFileFolderPath && newFileFolderPath.trim() !== '') {
                folderPath = newFileFolderPath.replace(/\/$/, '');
            }
        }

        // Build the file path
        let filePath: string;
        if (folderPath) {
            // Ensure folder exists
            const folder = app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await app.vault.createFolder(folderPath);
            }
            filePath = `${folderPath}/${noteTitle}.md`;
        } else {
            filePath = `${noteTitle}.md`;
        }

        // Handle filename conflicts by appending a number
        let finalPath = filePath;
        let counter = 1;
        while (app.vault.getAbstractFileByPath(finalPath)) {
            const basePath = filePath.replace('.md', '');
            finalPath = `${basePath} (${counter}).md`;
            counter++;
        }

        // Create the note with raw response text
        const file = await app.vault.create(finalPath, responseText);

        // Open the newly created note
        const leaf = app.workspace.getLeaf(false);
        if (file instanceof TFile) {
            await leaf.openFile(file);
        }

        logNotice(LogCategory.WORKFLOW, `Created note: ${file.name}`);
    }
}

