import { App, Setting, AbstractInputSuggest, TFolder, TFile } from "obsidian";

/**
 * Internal folder suggestion component.
 */
class FolderSuggestInternal extends AbstractInputSuggest<TFolder> {
    private textInputEl: HTMLInputElement;

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.textInputEl = inputEl;
    }

    getSuggestions(inputStr: string): TFolder[] {
        const inputLower = inputStr.toLowerCase().trim();
        const allFolders = this.getAllFolders();

        if (inputLower === "") {
            return allFolders;
        }

        return allFolders.filter(folder =>
            folder.path.toLowerCase().includes(inputLower)
        );
    }

    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        const displayPath = folder.path === "" ? "/" : folder.path;
        el.createEl("div", { text: displayPath, cls: "folder-suggest-item" });
    }

    selectSuggestion(folder: TFolder): void {
        this.textInputEl.value = folder.path;
        this.textInputEl.dispatchEvent(new Event("input", { bubbles: true }));
        this.close();
    }

    private getAllFolders(): TFolder[] {
        const folders: TFolder[] = [];
        
        const rootFolder = this.app.vault.getRoot();
        if (rootFolder) {
            folders.push(rootFolder);
        }

        const allFolders = this.app.vault.getAllFolders();
        folders.push(...allFolders);

        folders.sort((a, b) => {
            if (a.path === "") return -1;
            if (b.path === "") return 1;
            return a.path.localeCompare(b.path);
        });

        return folders;
    }
}

/**
 * Internal file suggestion component that filters by folder.
 */
class FileSuggestInternal extends AbstractInputSuggest<TFile> {
    private textInputEl: HTMLInputElement;
    private folderPath: string = "";

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.textInputEl = inputEl;
    }

    setFolderPath(folderPath: string): void {
        this.folderPath = folderPath;
    }

    getSuggestions(inputStr: string): TFile[] {
        const inputLower = inputStr.toLowerCase().trim();
        const files = this.getFilesInFolder();

        if (inputLower === "") {
            return files;
        }

        return files.filter(file => {
            const displayPath = this.getDisplayPath(file);
            return displayPath.toLowerCase().includes(inputLower);
        });
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        const displayPath = this.getDisplayPath(file);
        el.createEl("div", { text: displayPath, cls: "file-suggest-item" });
    }

    selectSuggestion(file: TFile): void {
        this.textInputEl.value = file.name;
        this.textInputEl.dataset.fullPath = file.path;
        this.textInputEl.dispatchEvent(new CustomEvent("file-selected", {
            bubbles: true,
            detail: { path: file.path, name: file.name }
        }));
        this.close();
    }

    private getDisplayPath(file: TFile): string {
        if (this.folderPath && file.path.startsWith(this.folderPath + "/")) {
            return file.path.substring(this.folderPath.length + 1);
        }
        return file.path;
    }

    private getFilesInFolder(): TFile[] {
        const allFiles = this.app.vault.getFiles();
        
        if (!this.folderPath) {
            return allFiles.sort((a, b) => a.path.localeCompare(b.path));
        }

        const normalizedFolder = this.folderPath.replace(/\/$/, "");
        const folder = this.app.vault.getAbstractFileByPath(normalizedFolder);
        
        if (!(folder instanceof TFolder)) {
            return [];
        }

        const filesInFolder = allFiles.filter(file => {
            if (normalizedFolder === "") {
                return true;
            }
            return file.path.startsWith(normalizedFolder + "/");
        });

        filesInFolder.sort((a, b) => a.path.localeCompare(b.path));
        return filesInFolder;
    }
}

/**
 * Mode for the path picker component.
 */
export type PathPickerMode = "folder-only" | "folder-file";

/**
 * Base options for the path picker.
 */
interface PathPickerBaseOptions {
    containerEl: HTMLElement;
    app: App;
    name: string;
    description: string;
    folderPlaceholder?: string;
    initialFolderPath?: string;
    onFolderChange?: (folderPath: string) => void;
}

/**
 * Options for folder-only mode.
 */
export interface FolderOnlyPickerOptions extends PathPickerBaseOptions {
    mode: "folder-only";
}

/**
 * Options for folder-file cascading mode.
 */
export interface FolderFilePickerOptions extends PathPickerBaseOptions {
    mode: "folder-file";
    filePlaceholder?: string;
    initialFilePath?: string;
    onFileChange?: (filePath: string) => void;
}

export type PathPickerOptions = FolderOnlyPickerOptions | FolderFilePickerOptions;

/**
 * Result for folder-only mode.
 */
export interface FolderOnlyPickerResult {
    setting: Setting;
    folderInputEl: HTMLInputElement;
}

/**
 * Result for folder-file mode.
 */
export interface FolderFilePickerResult {
    setting: Setting;
    folderInputEl: HTMLInputElement;
    fileInputEl: HTMLInputElement;
    fileSuggest: FileSuggestInternal;
}

export type PathPickerResult<T extends PathPickerOptions> =
    T extends FolderOnlyPickerOptions ? FolderOnlyPickerResult : FolderFilePickerResult;

/**
 * Create a unified path picker component.
 *
 * Supports two modes:
 * - "folder-only": Shows only a folder selection input
 * - "folder-file": Shows folder and file selection inputs side-by-side
 */
export function createPathPicker<T extends PathPickerOptions>(options: T): PathPickerResult<T> {
    if (options.mode === "folder-only") {
        return createFolderOnlyPicker(options) as PathPickerResult<T>;
    } else {
        return createFolderFilePicker(options) as PathPickerResult<T>;
    }
}

function createFolderOnlyPicker(options: FolderOnlyPickerOptions): FolderOnlyPickerResult {
    const {
        containerEl,
        app,
        name,
        description,
        folderPlaceholder = "Select folder...",
        initialFolderPath = "",
        onFolderChange
    } = options;

    let folderInputEl: HTMLInputElement;

    const setting = new Setting(containerEl)
        .setName(name)
        .setDesc(description)
        .addSearch(folderSearch => {
            folderInputEl = folderSearch.inputEl;
            folderSearch
                .setPlaceholder(folderPlaceholder)
                .setValue(initialFolderPath)
                .onChange((value) => {
                    onFolderChange?.(value);
                });

            new FolderSuggestInternal(app, folderSearch.inputEl);
            folderSearch.inputEl.addClass("path-picker-folder-input");
        });

    setting.settingEl.addClass("path-picker");

    return {
        setting,
        folderInputEl: folderInputEl!
    };
}

function createFolderFilePicker(options: FolderFilePickerOptions): FolderFilePickerResult {
    const {
        containerEl,
        app,
        name,
        description,
        folderPlaceholder = "Select folder...",
        filePlaceholder = "Select file...",
        initialFolderPath = "",
        initialFilePath = "",
        onFolderChange,
        onFileChange
    } = options;

    let folderInputEl: HTMLInputElement;
    let fileInputEl: HTMLInputElement;
    let fileSuggest: FileSuggestInternal;

    const setting = new Setting(containerEl)
        .setName(name)
        .setDesc(description)
        .addSearch(folderSearch => {
            folderInputEl = folderSearch.inputEl;
            folderSearch
                .setPlaceholder(folderPlaceholder)
                .setValue(initialFolderPath)
                .onChange((value) => {
                    if (fileSuggest) {
                        fileSuggest.setFolderPath(value);
                    }
                    // Enable/disable file input based on folder selection
                    if (fileInputEl) {
                        fileInputEl.disabled = !value;
                        // Clear file if folder is cleared
                        if (!value) {
                            fileInputEl.value = "";
                            fileInputEl.dataset.fullPath = "";
                            onFileChange?.("");
                        }
                    }
                    onFolderChange?.(value);
                });

            new FolderSuggestInternal(app, folderSearch.inputEl);
            folderSearch.inputEl.addClass("path-picker-folder-input");
        })
        .addSearch(fileSearch => {
            fileInputEl = fileSearch.inputEl;

            // Extract just the filename from the initial path for display
            const initialFileName = initialFilePath ? initialFilePath.split("/").pop() ?? "" : "";

            fileSearch
                .setPlaceholder(filePlaceholder)
                .setValue(initialFileName);

            // Disable file input if no folder is selected
            fileSearch.inputEl.disabled = !initialFolderPath;

            // Store the full path in dataset
            fileSearch.inputEl.dataset.fullPath = initialFilePath;

            // Listen for file selection (custom event with full path)
            fileSearch.inputEl.addEventListener("file-selected", ((e: CustomEvent) => {
                onFileChange?.(e.detail.path);
            }) as EventListener);

            fileSuggest = new FileSuggestInternal(app, fileSearch.inputEl);
            fileSuggest.setFolderPath(initialFolderPath);
            fileSearch.inputEl.addClass("path-picker-file-input");
        });

    setting.settingEl.addClass("path-picker", "path-picker-folder-file");

    return {
        setting,
        folderInputEl: folderInputEl!,
        fileInputEl: fileInputEl!,
        fileSuggest: fileSuggest!
    };
}

