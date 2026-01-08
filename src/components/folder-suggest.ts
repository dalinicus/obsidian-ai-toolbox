import { App, AbstractInputSuggest, TFolder } from "obsidian";

/**
 * A folder suggestion component that provides autocomplete for vault folder paths.
 * Uses Obsidian's AbstractInputSuggest to show folder suggestions as the user types.
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
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
        
        // Add root folder
        const rootFolder = this.app.vault.getRoot();
        if (rootFolder) {
            folders.push(rootFolder);
        }

        // Add all other folders
        const allFolders = this.app.vault.getAllFolders();
        folders.push(...allFolders);

        // Sort folders by path for better UX
        folders.sort((a, b) => {
            if (a.path === "") return -1;
            if (b.path === "") return 1;
            return a.path.localeCompare(b.path);
        });

        return folders;
    }
}

