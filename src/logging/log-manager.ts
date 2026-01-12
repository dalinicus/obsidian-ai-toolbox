import { Notice } from 'obsidian';
import { LogEntry, LogLevel, LogListener, LogUnsubscribe, LogCategoryType } from './types';

const MAX_LOGS = 500;

/**
 * Centralized log manager with subscription system for real-time log updates.
 */
class LogManager {
    private logs: LogEntry[] = [];
    private listeners: LogListener[] = [];

    /**
     * Add a log entry with the specified level, category, and message.
     */
    log(level: LogLevel, category: string, message: string, details?: unknown): void {
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            category,
            message,
            details
        };

        this.logs.push(entry);
        if (this.logs.length > MAX_LOGS) {
            this.logs = this.logs.slice(-MAX_LOGS);
        }

        // Console output based on level
        const formattedMsg = `[AI Toolbox] [${category}] ${message}`;
        switch (level) {
            case LogLevel.ERROR:
                console.error(formattedMsg, details !== undefined ? details : '');
                break;
            case LogLevel.WARN:
                console.warn(formattedMsg, details !== undefined ? details : '');
                break;
            case LogLevel.DEBUG:
                console.debug(formattedMsg, details !== undefined ? details : '');
                break;
            default:
                console.log(formattedMsg, details !== undefined ? details : '');
        }

        this.notifyListeners();
    }

    /**
     * Subscribe to log updates. Returns an unsubscribe function.
     */
    subscribe(callback: LogListener): LogUnsubscribe {
        this.listeners.push(callback);
        callback([...this.logs]); // Initial call with current logs
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners(): void {
        const logsCopy = [...this.logs];
        this.listeners.forEach(cb => cb(logsCopy));
    }

    /**
     * Get a copy of all current logs.
     */
    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    /**
     * Clear all logs.
     */
    clear(): void {
        this.logs = [];
        this.notifyListeners();
    }

    /**
     * Get the count of logs at each level.
     */
    getLogCounts(): Record<LogLevel, number> {
        const counts = {
            [LogLevel.DEBUG]: 0,
            [LogLevel.INFO]: 0,
            [LogLevel.WARN]: 0,
            [LogLevel.ERROR]: 0
        };
        for (const log of this.logs) {
            counts[log.level]++;
        }
        return counts;
    }
}

/** Singleton log manager instance */
export const logManager = new LogManager();

// Convenience functions for logging at specific levels
export function logDebug(category: LogCategoryType | string, message: string, details?: unknown): void {
    logManager.log(LogLevel.DEBUG, category, message, details);
}

export function logInfo(category: LogCategoryType | string, message: string, details?: unknown): void {
    logManager.log(LogLevel.INFO, category, message, details);
}

export function logWarn(category: LogCategoryType | string, message: string, details?: unknown): void {
    logManager.log(LogLevel.WARN, category, message, details);
}

export function logError(category: LogCategoryType | string, message: string, details?: unknown): void {
    logManager.log(LogLevel.ERROR, category, message, details);
}

/**
 * Log at INFO level and also display an Obsidian Notice to the user.
 */
export function logNotice(category: LogCategoryType | string, message: string, details?: unknown): void {
    logManager.log(LogLevel.INFO, category, message, details);
    new Notice(message);
}

