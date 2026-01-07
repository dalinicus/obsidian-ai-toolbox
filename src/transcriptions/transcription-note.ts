import { App, Notice, TFile } from 'obsidian';
import { TranscriptionResult } from '../providers';
import { VideoMetadata, videoPlatformRegistry } from './video-platforms';
import { generateFilenameTimestamp } from '../utils/date-utils';

/**
 * Creates a new Obsidian note with the transcription content.
 *
 * @param app - Obsidian App instance
 * @param result - Transcription result from Whisper
 * @param sourceUrl - Source URL of the video
 * @param includeTimestamps - Whether to include timestamps in the note
 * @param notesFolder - Optional folder path where the note should be created
 * @param videoMetadata - Optional video metadata (description, tags)
 * @returns The created TFile
 */
export async function createTranscriptionNote(
	app: App,
	result: TranscriptionResult,
	sourceUrl: string,
	includeTimestamps = false,
	notesFolder = '',
	videoMetadata?: VideoMetadata
): Promise<TFile> {
	try {
		// Generate note filename from video metadata
		const noteFilename = generateNoteFilename(sourceUrl, videoMetadata);

		// Build full path with optional folder
		let notePath = noteFilename;
		if (notesFolder) {
			// Normalize the folder path (remove leading/trailing slashes)
			const normalizedFolder = notesFolder.replace(/^\/+|\/+$/g, '');

			// Ensure the folder exists
			const folderExists = app.vault.getAbstractFileByPath(normalizedFolder);
			if (!folderExists) {
				await app.vault.createFolder(normalizedFolder);
			}

			notePath = `${normalizedFolder}/${noteFilename}`;
		}

		// Format the note content
		const noteContent = await formatNoteContent(result, sourceUrl, includeTimestamps, videoMetadata);

		// Create the note
		const file = await app.vault.create(notePath, noteContent);

		new Notice(`Transcription note created: ${notePath}`);

		return file;
	} catch (error) {
		console.error('Failed to create transcription note:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		new Notice(`Failed to create note: ${errorMessage}`);
		throw error;
	}
}

/**
 * Opens a transcription note in the editor.
 * 
 * @param app - Obsidian App instance
 * @param file - The TFile to open
 */
export async function openTranscriptionNote(app: App, file: TFile): Promise<void> {
	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(file);
}



/**
 * Generates a filename for the transcription note based on video metadata.
 * Format: "{title} by {uploader} - {timestamp}.md"
 *
 * @param sourceUrl - Source URL to detect platform
 * @param videoMetadata - Video metadata containing title and uploader
 * @returns Markdown filename for the note
 */
export function generateNoteFilename(
	sourceUrl: string,
	videoMetadata?: VideoMetadata
): string {
	// Add timestamp to ensure uniqueness
	const timestamp = generateFilenameTimestamp();

	// Determine title using platform handler (each platform decides how to handle metadata)
	const handler = videoPlatformRegistry.findHandlerForUrl(sourceUrl);
	if (!handler) {
		throw new Error(`No handler found for URL: ${sourceUrl}`);
	}
	const title = handler.getTitle(videoMetadata);

	// Determine uploader
	const uploader = videoMetadata?.uploader || 'Unknown';

	// Sanitize filename (remove characters that are invalid in filenames)
	const sanitize = (str: string): string => str.replace(/[<>:"/\\|?*]/g, '-');

	return `${sanitize(title)} by ${sanitize(uploader)} - ${timestamp}.md`;
}

/**
 * Formats the transcription content into a well-structured markdown note.
 *
 * @param result - Transcription result from Whisper
 * @param sourceUrl - Optional source URL of the video
 * @param includeTimestamps - Whether to include timestamps
 * @param videoMetadata - Optional video metadata (description, tags)
 * @returns Formatted markdown content
 */
export async function formatNoteContent(
	result: TranscriptionResult,
	sourceUrl?: string,
	includeTimestamps = false,
	videoMetadata?: VideoMetadata
): Promise<string> {
	const lines: string[] = [];

	// Add source URL if available
	if (sourceUrl) {
		lines.push('# Video Source');
		lines.push('');

		const handler = videoPlatformRegistry.findHandlerForUrl(sourceUrl);
		if (handler) {
			const videoId = await handler.extractVideoId(sourceUrl);
			if (videoId) {
				const embed = handler.generateEmbed(videoId, sourceUrl);
				lines.push(embed.iframeHtml);
				lines.push(embed.markdownLink);
			} else {
				lines.push(`[Watch on ${handler.platformName}](${sourceUrl})`);
			}
		}
		lines.push('');
	}

	// Add video metadata section if available
	if (videoMetadata && videoMetadata.description) {
		lines.push('# Description');
		lines.push('');
		lines.push(videoMetadata.description);
		lines.push('');
	}

	if (videoMetadata && videoMetadata.tags && videoMetadata.tags.length > 0) {
		lines.push('# Tags');
		lines.push('');
		// Format tags as a comma-separated list with hashtags
		const formattedTags = videoMetadata.tags.map(tag => `#${tag.replace(/\s+/g, '-')}`).join(' ');
		lines.push(formattedTags);
		lines.push('');
	}
	
	// Add transcription section
	lines.push('# Transcription');
	lines.push('');

	if (includeTimestamps && result.chunks && result.chunks.length > 0) {
		// Format with timestamps
		for (const chunk of result.chunks) {
			const timestampStr = formatTimestamp(chunk.timestamp);
			lines.push(`**[${timestampStr}]** ${chunk.text}`);
		}
		lines.push('');
	} else {
		// Format without timestamps - just the full text
		lines.push(result.text);
		lines.push('');
	}

	return lines.join('\n');
}

/**
 * Formats a timestamp tuple into a readable string (MM:SS or HH:MM:SS).
 *
 * @param timestamp - Tuple of [start, end | null] in seconds
 * @returns Formatted timestamp string (only start time)
 */
export function formatTimestamp(timestamp: [number, number | null]): string {
	const [start] = timestamp;

	const formatTime = (seconds: number): string => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		} else {
			return `${minutes}:${secs.toString().padStart(2, '0')}`;
		}
	};

	return formatTime(start);
}

