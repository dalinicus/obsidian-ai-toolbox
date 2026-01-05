import { App, Notice, TFile, requestUrl } from 'obsidian';
import { TranscriptionResult } from './whisper-transcriber';
import { VideoMetadata } from './video-downloader';
import * as path from 'path';

/**
 * Interface for TikTok oEmbed API response
 */
interface TikTokOEmbedResponse {
	html?: string;
	[key: string]: unknown;
}

/**
 * Extracts the video ID from a TikTok URL using the oEmbed API.
 * This handles all TikTok URL formats (short URLs, /t/ URLs, etc.)
 *
 * @param url - TikTok URL (any format)
 * @returns Video ID or null if extraction fails
 */
async function extractVideoIdFromUrl(url: string): Promise<string | null> {
	try {
		const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
		const response = await requestUrl({
			url: oembedUrl,
			method: 'GET',
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; Obsidian-AI-Toolbox/1.0)'
			}
		});

		if (response.status === 200) {
			const data = response.json as TikTokOEmbedResponse;
			if (data.html) {
				const videoIdMatch = data.html.match(/data-video-id="(\d+)"/);
				if (videoIdMatch?.[1]) {
					return videoIdMatch[1];
				}
			}
		}
	} catch (error) {
		console.error('Failed to extract video ID from TikTok URL:', error);
	}

	return null;
}

/**
 * Creates a new Obsidian note with the transcription content.
 *
 * @param app - Obsidian App instance
 * @param result - Transcription result from Whisper
 * @param sourceUrl - Optional source URL of the video
 * @param includeTimestamps - Whether to include timestamps in the note
 * @param notesFolder - Optional folder path where the note should be created
 * @param videoMetadata - Optional video metadata (description, tags)
 * @returns The created TFile
 */
export async function createTranscriptionNote(
	app: App,
	result: TranscriptionResult,
	sourceUrl?: string,
	includeTimestamps = false,
	notesFolder = '',
	videoMetadata?: VideoMetadata
): Promise<TFile> {
	try {
		// Generate note filename from video metadata
		const noteFilename = generateNoteFilename(videoMetadata, sourceUrl);

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
 * Checks if a URL is a TikTok URL.
 */
function isTikTokUrl(url: string): boolean {
	const tiktokPatterns = [
		/^https?:\/\/(www\.)?tiktok\.com\//i,
		/^https?:\/\/(vm|vt)\.tiktok\.com\//i,
	];
	return tiktokPatterns.some(pattern => pattern.test(url));
}

/**
 * Checks if a URL is a YouTube URL.
 */
function isYouTubeUrl(url: string): boolean {
	const youtubePatterns = [
		/^https?:\/\/(www\.)?youtube\.com\//i,
		/^https?:\/\/youtu\.be\//i,
	];
	return youtubePatterns.some(pattern => pattern.test(url));
}

/**
 * Extracts the YouTube video ID from a URL.
 */
function extractYouTubeVideoId(url: string): string | null {
	// Handle youtu.be/VIDEO_ID
	const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
	if (shortMatch?.[1]) return shortMatch[1];

	// Handle youtube.com/watch?v=VIDEO_ID
	const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
	if (watchMatch?.[1]) return watchMatch[1];

	// Handle youtube.com/shorts/VIDEO_ID
	const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
	if (shortsMatch?.[1]) return shortsMatch[1];

	// Handle youtube.com/embed/VIDEO_ID
	const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]+)/);
	if (embedMatch?.[1]) return embedMatch[1];

	return null;
}

/**
 * Generates a filename for the transcription note based on video metadata.
 * Format: "{title} by {uploader} - {timestamp}.md"
 * For TikTok, uses "TikTok" as the title since TikTok titles are often unavailable.
 *
 * @param videoMetadata - Video metadata containing title and uploader
 * @param sourceUrl - Source URL to detect platform (for TikTok handling)
 * @returns Markdown filename for the note
 */
export function generateNoteFilename(
	videoMetadata?: VideoMetadata,
	sourceUrl?: string
): string {
	// Add timestamp to ensure uniqueness
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

	// Determine title - use "TikTok" for TikTok URLs, otherwise use metadata or fallback
	let title: string;
	if (sourceUrl && isTikTokUrl(sourceUrl)) {
		title = 'TikTok';
	} else if (videoMetadata?.title) {
		title = videoMetadata.title;
	} else {
		title = 'Video';
	}

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
	
		if (isTikTokUrl(sourceUrl)) {
			const videoId = await extractVideoIdFromUrl(sourceUrl);
			if (videoId) {
				lines.push(`<iframe width="325" height="760" src="https://www.tiktok.com/embed/v2/${videoId}?autoplay=0"></iframe>`);
			}
			lines.push(`[Watch on TikTok](${sourceUrl})`);
		} else if (isYouTubeUrl(sourceUrl)) {
			const videoId = extractYouTubeVideoId(sourceUrl);
			if (videoId) {
				lines.push(`<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`);
			}
			lines.push(`[Watch on YouTube](${sourceUrl})`);
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

