/**
 * Time format validation and conversion utilities for video/audio extraction.
 * Supports formats: MM:SS, HH:MM:SS, or empty string.
 */

/**
 * Regular expression patterns for time format validation.
 * Supports MM:SS (00:00 to 59:59) and HH:MM:SS (00:00:00+).
 */
const TIME_PATTERN_MMSS = /^(\d{1,2}):(\d{2})$/;
const TIME_PATTERN_HHMMSS = /^(\d+):(\d{2}):(\d{2})$/;

/**
 * Result of time validation.
 */
export interface TimeValidationResult {
    isValid: boolean;
    errorMessage?: string;
    /** Total seconds (only set if valid) */
    totalSeconds?: number;
}

/**
 * Result of time range validation.
 */
export interface TimeRangeValidationResult {
    isValid: boolean;
    errorMessage?: string;
    startSeconds?: number;
    endSeconds?: number;
}

/**
 * Validates a time string and returns the result.
 * Accepts empty string (valid), MM:SS, or HH:MM:SS formats.
 * 
 * @param timeStr - The time string to validate
 * @returns Validation result with optional total seconds
 */
export function validateTimeFormat(timeStr: string): TimeValidationResult {
    // Empty string is valid (means "from start" or "to end")
    if (!timeStr || timeStr.trim() === '') {
        return { isValid: true };
    }

    const trimmed = timeStr.trim();

    // Try MM:SS format first
    const mmssMatch = trimmed.match(TIME_PATTERN_MMSS);
    if (mmssMatch && mmssMatch[1] !== undefined && mmssMatch[2] !== undefined) {
        const minutes = parseInt(mmssMatch[1], 10);
        const seconds = parseInt(mmssMatch[2], 10);

        if (seconds >= 60) {
            return { isValid: false, errorMessage: 'Seconds must be 0-59' };
        }

        return {
            isValid: true,
            totalSeconds: minutes * 60 + seconds
        };
    }

    // Try HH:MM:SS format
    const hhmmssMatch = trimmed.match(TIME_PATTERN_HHMMSS);
    if (hhmmssMatch && hhmmssMatch[1] !== undefined && hhmmssMatch[2] !== undefined && hhmmssMatch[3] !== undefined) {
        const hours = parseInt(hhmmssMatch[1], 10);
        const minutes = parseInt(hhmmssMatch[2], 10);
        const seconds = parseInt(hhmmssMatch[3], 10);

        if (minutes >= 60) {
            return { isValid: false, errorMessage: 'Minutes must be 0-59' };
        }
        if (seconds >= 60) {
            return { isValid: false, errorMessage: 'Seconds must be 0-59' };
        }

        return {
            isValid: true,
            totalSeconds: hours * 3600 + minutes * 60 + seconds
        };
    }

    return {
        isValid: false,
        errorMessage: 'Invalid time format. Use MM:SS or HH:MM:SS'
    };
}

/**
 * Validates a time range ensuring start is before end.
 * Empty strings are valid and represent start/end of media.
 * 
 * @param startTime - Start time string (empty for beginning)
 * @param endTime - End time string (empty for end of media)
 * @returns Validation result with optional parsed seconds
 */
export function validateTimeRange(startTime: string, endTime: string): TimeRangeValidationResult {
    const startResult = validateTimeFormat(startTime);
    if (!startResult.isValid) {
        return {
            isValid: false,
            errorMessage: `Start time: ${startResult.errorMessage}`
        };
    }

    const endResult = validateTimeFormat(endTime);
    if (!endResult.isValid) {
        return {
            isValid: false,
            errorMessage: `End time: ${endResult.errorMessage}`
        };
    }

    // If both times are provided, ensure start < end
    if (startResult.totalSeconds !== undefined && endResult.totalSeconds !== undefined) {
        if (startResult.totalSeconds >= endResult.totalSeconds) {
            return {
                isValid: false,
                errorMessage: 'Start time must be before end time'
            };
        }
    }

    return {
        isValid: true,
        startSeconds: startResult.totalSeconds,
        endSeconds: endResult.totalSeconds
    };
}

/**
 * Formats a time range for yt-dlp's --download-sections argument.
 * Returns the section string in format "*startTime-endTime".
 * 
 * @param startTime - Start time (MM:SS or HH:MM:SS, or empty for start)
 * @param endTime - End time (MM:SS or HH:MM:SS, or empty for end)
 * @returns The formatted section string for yt-dlp, or null if validation fails
 */
export function formatYtDlpSection(startTime: string, endTime: string): string | null {
    const validation = validateTimeRange(startTime, endTime);
    if (!validation.isValid) {
        return null;
    }

    // yt-dlp uses "inf" for end of video
    const start = startTime.trim() || '0:00';
    const end = endTime.trim() || 'inf';

    return `*${start}-${end}`;
}

/**
 * Formats a time range for ffmpeg's -ss and -to arguments.
 * Returns an object with the formatted arguments.
 * 
 * @param startTime - Start time (MM:SS or HH:MM:SS, or empty)
 * @param endTime - End time (MM:SS or HH:MM:SS, or empty)
 * @returns Object with ffmpeg arguments, or null if validation fails
 */
export function formatFfmpegTimeArgs(startTime: string, endTime: string): { ssArg?: string; toArg?: string } | null {
    const validation = validateTimeRange(startTime, endTime);
    if (!validation.isValid) {
        return null;
    }

    const result: { ssArg?: string; toArg?: string } = {};

    if (startTime.trim()) {
        result.ssArg = startTime.trim();
    }

    if (endTime.trim()) {
        result.toArg = endTime.trim();
    }

    return result;
}

