import { ItemView, WorkspaceLeaf } from 'obsidian';
import { logManager } from './log-manager';
import { LogEntry, LogLevel, LogUnsubscribe } from './types';
import type AIToolboxPlugin from '../main';

export const VIEW_TYPE_LOG = 'ai-toolbox-log';

/**
 * Log pane view for displaying AI Toolbox plugin logs in a dedicated Obsidian panel.
 */
export class LogPaneView extends ItemView {
    plugin: AIToolboxPlugin;
    private logContainer: HTMLElement;
    private unsubscribe: LogUnsubscribe | null = null;
    private autoScroll = true;
    private filterLevel: LogLevel = LogLevel.DEBUG;

    constructor(leaf: WorkspaceLeaf, plugin: AIToolboxPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_LOG;
    }

    getDisplayText(): string {
        return 'AI Toolbox Log';
    }

    getIcon(): string {
        return 'scroll-text';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('ai-toolbox-log-view');

        this.buildControls(container);
        this.logContainer = container.createDiv({ cls: 'log-container' });

        this.unsubscribe = logManager.subscribe(logs => this.renderLogs(logs));
    }

    private buildControls(container: HTMLElement): void {
        const controls = container.createDiv({ cls: 'log-controls' });

        // Filter dropdown
        const filterLabel = controls.createEl('label', { cls: 'log-control-item' });
        filterLabel.createSpan({ text: 'Level: ' });
        const select = filterLabel.createEl('select', { cls: 'dropdown' });
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        levels.forEach((level, i) => {
            const option = select.createEl('option', { value: String(i), text: level });
            if (i === this.filterLevel) option.selected = true;
        });
        select.addEventListener('change', () => {
            this.filterLevel = parseInt(select.value);
            this.renderLogs(logManager.getLogs());
        });

        // Auto-scroll toggle
        const autoScrollLabel = controls.createEl('label', { cls: 'log-control-item' });
        const checkbox = autoScrollLabel.createEl('input', { type: 'checkbox' });
        checkbox.checked = this.autoScroll;
        checkbox.addEventListener('change', () => {
            this.autoScroll = checkbox.checked;
        });
        autoScrollLabel.appendText(' Auto-scroll');

        // Spacer
        controls.createDiv({ cls: 'log-controls-spacer' });

        // Clear button
        const clearBtn = controls.createEl('button', { text: 'Clear', cls: 'mod-warning' });
        clearBtn.addEventListener('click', () => logManager.clear());

        // Copy button
        const copyBtn = controls.createEl('button', { text: 'Copy All' });
        copyBtn.addEventListener('click', () => this.copyLogs());
    }

    private renderLogs(logs: LogEntry[]): void {
        this.logContainer.empty();
        const filtered = logs.filter(l => l.level >= this.filterLevel);

        for (const entry of filtered) {
            const levelName = LogLevel[entry.level].toLowerCase();
            const line = this.logContainer.createDiv({ cls: `log-entry log-${levelName}` });

            const time = entry.timestamp.toLocaleTimeString();
            line.createSpan({ cls: 'log-time', text: `[${time}]` });
            line.createSpan({ cls: 'log-level', text: ` [${LogLevel[entry.level]}]` });
            line.createSpan({ cls: 'log-category', text: ` [${entry.category}]` });
            line.createSpan({ cls: 'log-message', text: ` ${entry.message}` });
        }

        if (this.autoScroll) {
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
    }

    private copyLogs(): void {
        const text = logManager.getLogs()
            .map(e => `[${e.timestamp.toISOString()}] [${LogLevel[e.level]}] [${e.category}] ${e.message}`)
            .join('\n');
        navigator.clipboard.writeText(text);
    }

    async onClose(): Promise<void> {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

