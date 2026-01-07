/**
 * Generates a filename-safe timestamp string.
 * Format: YYYY-MM-DDTHH-MM-SS (ISO-like format with dashes instead of colons)
 * 
 * @returns Formatted timestamp string suitable for use in filenames
 */
export function generateFilenameTimestamp(): string {
	return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

