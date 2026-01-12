// Re-export types
export { LogLevel, LogCategory } from './types';
export type { LogEntry, LogListener, LogUnsubscribe, LogCategoryType } from './types';

// Re-export log manager and convenience functions
export { logManager, logDebug, logInfo, logWarn, logError, logNotice } from './log-manager';

// Re-export log pane view
export { VIEW_TYPE_LOG, LogPaneView } from './log-pane-view';

