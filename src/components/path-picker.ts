import { App, Setting, AbstractInputSuggest, TAbstractFile } from "obsidian";

/**
 * Type of path selection.
 */
export type PathSelectionType = "folder" | "file";

/**
 * Represents a path item (folder or file) in the unified picker.
 */
interface PathItem {
    type: PathSelectionType;
    path: string;
    displayPath: string;
    item: TAbstractFile;
}

/**
 * Unified path suggestion component that shows both folders and files.
 */
class UnifiedPathSuggest extends AbstractInputSuggest<PathItem> {
    private textInputEl: HTMLInputElement;
    private includeFiles: boolean;
    private onPathSelected: (path: string, type: PathSelectionType) => void;

    constructor(
        app: App,
        inputEl: HTMLInputElement,
        includeFiles: boolean,
        onPathSelected: (path: string, type: PathSelectionType) => void
    ) {
        super(app, inputEl);
        this.textInputEl = inputEl;
        this.includeFiles = includeFiles;
        this.onPathSelected = onPathSelected;
    }

    getSuggestions(inputStr: string): PathItem[] {
        const inputLower = inputStr.toLowerCase().trim();
        const items = this.getAllItems();

        if (inputLower === "") {
            return items;
        }

        return items.filter(item =>
            item.path.toLowerCase().includes(inputLower)
        );
    }

    renderSuggestion(item: PathItem, el: HTMLElement): void {
        el.addClass("path-picker-suggestion");
        el.createEl("span", {
            text: item.displayPath,
            cls: `path-picker-${item.type}`
        });
    }

    selectSuggestion(item: PathItem): void {
        this.textInputEl.value = item.path;
        this.textInputEl.dataset.selectionType = item.type;
        this.onPathSelected(item.path, item.type);
        this.close();
    }

    private getAllItems(): PathItem[] {
        const items: PathItem[] = [];

        // Add folders
        const rootFolder = this.app.vault.getRoot();
        if (rootFolder) {
            items.push({
                type: "folder",
                path: "",
                displayPath: "/ (root)",
                item: rootFolder
            });
        }

        for (const folder of this.app.vault.getAllFolders()) {
            items.push({
                type: "folder",
                path: folder.path,
                displayPath: folder.path,
                item: folder
            });
        }

        // Add markdown files if enabled
        if (this.includeFiles) {
            for (const file of this.app.vault.getMarkdownFiles()) {
                // Display path without .md extension
                const displayPath = file.path.replace(/\.md$/, "");
                items.push({
                    type: "file",
                    path: file.path,
                    displayPath: displayPath,
                    item: file
                });
            }
        }

        // Sort: folders first (root at top), then files, alphabetically within each group
        items.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === "folder" ? -1 : 1;
            }
            // Root folder always first
            if (a.path === "") return -1;
            if (b.path === "") return 1;
            return a.path.localeCompare(b.path);
        });

        return items;
    }
}

/**
 * Options for the unified path picker.
 */
export interface PathPickerOptions {
    containerEl: HTMLElement;
    app: App;
    name: string;
    description: string;
    placeholder?: string;
    initialPath?: string;
    /** If true, shows both folders and files; if false, only folders */
    allowFiles?: boolean;
    /** Called when the user selects a path */
    onChange?: (path: string, type: PathSelectionType) => void;
}

/**
 * Result from creating a path picker.
 */
export interface PathPickerResult {
    setting: Setting;
    inputEl: HTMLInputElement;
}

/**
 * Create a unified path picker component with a single search input.
 *
 * Shows folders and optionally files in one searchable list.
 * Automatically determines selection type based on what the user picks.
 */
export function createPathPicker(options: PathPickerOptions): PathPickerResult {
    const {
        containerEl,
        app,
        name,
        description,
        placeholder = "Search...",
        initialPath = "",
        allowFiles = false,
        onChange
    } = options;

    let inputEl: HTMLInputElement;

    const setting = new Setting(containerEl)
        .setName(name)
        .setDesc(description)
        .addSearch(search => {
            inputEl = search.inputEl;
            search
                .setPlaceholder(placeholder)
                .setValue(initialPath);

            new UnifiedPathSuggest(
                app,
                search.inputEl,
                allowFiles,
                (path, type) => {
                    onChange?.(path, type);
                }
            );

            search.inputEl.addClass("path-picker-input");
        });

    setting.settingEl.addClass("path-picker");

    return {
        setting,
        inputEl: inputEl!
    };
}
