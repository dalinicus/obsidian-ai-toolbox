import { TFile, FuzzySuggestModal, Notice } from 'obsidian';
import { InputHandler, InputContext, InputResult } from './types';
import * as path from 'path';
import { ExtractionMode } from '../../settings';
import { trimAudioFile } from '../../processing';

/**
 * Supported audio file extensions for transcription.
 */
const SUPPORTED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac', 'aac'];

/**
 * Options for vault file input handler
 */
export interface VaultFileInputOptions {
    extractionMode?: ExtractionMode;
    startTime?: string;
    endTime?: string;
}

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
 * Optionally trims the audio to a specific time range using ffmpeg.
 */
export class VaultFileInputHandler implements InputHandler {
    private options: VaultFileInputOptions;

    constructor(options: VaultFileInputOptions = {}) {
        this.options = options;
    }

    async getInput(context: InputContext): Promise<InputResult | null> {
        return new Promise((resolve) => {
            const modal = new AudioFileSelectorModal(context.app, (file) => {
                if (!file) {
                    resolve(null);
                    return;
                }

                void this.processSelectedFile(file, context, resolve);
            });

            modal.open();
        });
    }

    private async processSelectedFile(
        file: TFile,
        context: InputContext,
        resolve: (value: InputResult | null) => void
    ): Promise<void> {
        // Get the absolute path to the audio file
        const adapter = context.app.vault.adapter as unknown as { basePath: string };
        let audioFilePath = path.join(adapter.basePath, file.path);

        // Apply time range trimming if custom mode is selected
        if (this.options.extractionMode === 'custom' &&
            (this.options.startTime?.trim() || this.options.endTime?.trim())) {
            try {
                new Notice('Trimming audio to specified time range...');
                const trimResult = await trimAudioFile({
                    inputPath: audioFilePath,
                    extractionMode: this.options.extractionMode,
                    startTime: this.options.startTime,
                    endTime: this.options.endTime,
                    ffmpegLocation: context.settings.ffmpegLocation,
                });
                audioFilePath = trimResult.audioFilePath;
                if (trimResult.wasTrimmed) {
                    new Notice('Audio trimmed successfully');
                }
            } catch (error) {
                new Notice(`Failed to trim audio: ${error instanceof Error ? error.message : String(error)}`);
                resolve(null);
                return;
            }
        }

        resolve({
            audioFilePath,
            metadata: {
                title: file.basename,
            }
        });
    }
}

