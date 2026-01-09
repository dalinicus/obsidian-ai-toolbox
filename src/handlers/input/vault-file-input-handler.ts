import { TFile, FuzzySuggestModal } from 'obsidian';
import { InputHandler, InputContext, InputResult } from './types';
import * as path from 'path';

/**
 * Supported audio file extensions for transcription.
 */
const SUPPORTED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac', 'aac'];

/**
 * Modal for selecting an audio file from the vault.
 */
class AudioFileSelectorModal extends FuzzySuggestModal<TFile> {
    private audioFiles: TFile[];
    private onSelect: (file: TFile | null) => void;
    private wasSelected = false;

    constructor(
        app: import('obsidian').App,
        onSelect: (file: TFile | null) => void
    ) {
        super(app);
        this.onSelect = onSelect;

        this.audioFiles = app.vault.getFiles().filter(file => {
            const ext = file.extension.toLowerCase();
            return SUPPORTED_AUDIO_EXTENSIONS.includes(ext);
        });

        this.setPlaceholder('Select an audio file to transcribe...');
    }

    getItems(): TFile[] {
        return this.audioFiles;
    }

    getItemText(file: TFile): string {
        return file.path;
    }

    onChooseItem(file: TFile): void {
        this.wasSelected = true;
        this.onSelect(file);
    }

    onClose(): void {
        if (!this.wasSelected) {
            this.onSelect(null);
        }
    }
}

/**
 * Input handler that prompts the user to select an audio file from the vault.
 */
export class VaultFileInputHandler implements InputHandler {
    async getInput(context: InputContext): Promise<InputResult | null> {
        return new Promise((resolve) => {
            const modal = new AudioFileSelectorModal(context.app, (file) => {
                if (!file) {
                    resolve(null);
                    return;
                }

                // Get the absolute path to the audio file
                const adapter = context.app.vault.adapter as unknown as { basePath: string };
                const audioFilePath = path.join(adapter.basePath, file.path);

                resolve({
                    audioFilePath,
                    metadata: {
                        title: file.basename,
                    }
                });
            });

            modal.open();
        });
    }
}

