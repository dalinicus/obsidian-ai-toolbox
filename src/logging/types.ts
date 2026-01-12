/**
 * Log level enumeration for categorizing log messages.
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Represents a single log entry with timestamp, level, category, and message.
 */
export interface LogEntry {
    /** When the log entry was created */
    timestamp: Date;
    /** Severity level of the log */
    level: LogLevel;
    /** Category/module that generated the log (e.g., "workflow", "provider", "transcription") */
    category: string;
    /** The log message */
    message: string;
    /** Optional additional details (objects, errors, etc.) */
    details?: unknown;
}

/**
 * Callback type for log subscription listeners.
 */
export type LogListener = (logs: LogEntry[]) => void;

/**
 * Unsubscribe function returned when subscribing to log updates.
 */
export type LogUnsubscribe = () => void;

/**
 * Log category constants for consistent categorization.
 */
export const LogCategory = {
    PLUGIN: 'plugin',
    WORKFLOW: 'workflow',
    PROVIDER: 'provider',
    TRANSCRIPTION: 'transcription',
    INPUT: 'input',
    OUTPUT: 'output',
    VIDEO: 'video',
    AUDIO: 'audio'
} as const;

export type LogCategoryType = typeof LogCategory[keyof typeof LogCategory];

