import { Buffer } from 'buffer';
import * as fs from 'fs';

/**
 * Interface for transcription API response
 */
export interface TranscriptionApiResponse {
    text: string;
    segments?: Array<{ text: string; start: number; end: number }>;
}

/**
 * Individual chunk with timestamps from transcription
 */
export interface TranscriptionChunk {
    text: string;
    timestamp: [number, number | null];
}

/**
 * Result from audio transcription
 */
export interface TranscriptionResult {
    text: string;
    chunks?: TranscriptionChunk[];
    audioFilePath: string;
}

/**
 * Interface for additional form fields to include in multipart form data
 */
export interface FormField {
    name: string;
    value: string;
}

/**
 * Options for building multipart form data for audio transcription
 */
export interface MultipartFormDataOptions {
    boundary: string;
    audioBuffer: Buffer;
    fileName: string;
    includeTimestamps: boolean;
    language?: string;
    additionalFields?: FormField[];
}

/**
 * Options for preparing audio form data from a file path
 */
export interface PrepareAudioFormDataOptions {
    audioFilePath: string;
    includeTimestamps: boolean;
    language?: string;
    additionalFields?: FormField[];
}

/**
 * Result from preparing audio form data
 */
export interface PreparedAudioFormData {
    boundary: string;
    formData: ArrayBuffer;
    fileName: string;
}

/**
 * Combines string and Buffer parts into a single ArrayBuffer.
 * Used internally by buildMultipartFormData.
 */
function combinePartsToArrayBuffer(parts: (string | Buffer)[]): ArrayBuffer {
    const encoder = new TextEncoder();
    const buffers: Uint8Array[] = parts.map(part => {
        if (typeof part === 'string') {
            return encoder.encode(part);
        }
        return new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
    });

    const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
        combined.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
    }

    return combined.buffer;
}

/**
 * Builds multipart form data for audio transcription API requests.
 * Creates a properly formatted multipart/form-data body with the audio file
 * and optional configuration fields.
 *
 * @param options - Configuration for the multipart form data
 * @returns ArrayBuffer containing the complete multipart form data
 */
export function buildMultipartFormData(options: MultipartFormDataOptions): ArrayBuffer {
    const { boundary, audioBuffer, fileName, includeTimestamps, language, additionalFields = [] } = options;
    const parts: (string | Buffer)[] = [];

    // File field
    parts.push(`--${boundary}\r\n`);
    parts.push(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`);
    parts.push(`Content-Type: application/octet-stream\r\n\r\n`);
    parts.push(audioBuffer);
    parts.push('\r\n');

    // Additional provider-specific fields (e.g., model for OpenAI)
    for (const field of additionalFields) {
        parts.push(`--${boundary}\r\n`);
        parts.push(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n`);
        parts.push(`${field.value}\r\n`);
    }

    // Response format
    const responseFormat = includeTimestamps ? 'verbose_json' : 'json';
    parts.push(`--${boundary}\r\n`);
    parts.push(`Content-Disposition: form-data; name="response_format"\r\n\r\n`);
    parts.push(`${responseFormat}\r\n`);

    // Language (optional)
    if (language) {
        parts.push(`--${boundary}\r\n`);
        parts.push(`Content-Disposition: form-data; name="language"\r\n\r\n`);
        parts.push(`${language}\r\n`);
    }

    // Timestamp granularities (for verbose_json)
    if (includeTimestamps) {
        parts.push(`--${boundary}\r\n`);
        parts.push(`Content-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\n`);
        parts.push(`segment\r\n`);
    }

    parts.push(`--${boundary}--\r\n`);

    return combinePartsToArrayBuffer(parts);
}

/**
 * Generates a random boundary string for multipart form data.
 * @returns A unique boundary string
 */
export function generateFormBoundary(): string {
    return '----FormBoundary' + Math.random().toString(36).substring(2);
}

/**
 * Validates that an audio file exists at the given path.
 * @param audioFilePath - Path to the audio file
 * @throws Error if the file does not exist
 */
export function validateAudioFile(audioFilePath: string): void {
    if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
    }
}

/**
 * Extracts the filename from a file path.
 * @param filePath - Full path to the file
 * @param defaultName - Default name if extraction fails
 * @returns The extracted filename
 */
export function extractFileName(filePath: string, defaultName = 'audio.mp3'): string {
    return filePath.split(/[/\\]/).pop() || defaultName;
}

/**
 * Prepares audio form data for transcription API requests.
 * Reads the audio file, generates a boundary, and builds the multipart form data.
 *
 * @param options - Configuration for preparing the form data
 * @returns Object containing the boundary and prepared form data
 * @throws Error if the audio file cannot be read
 */
export function prepareAudioFormData(options: PrepareAudioFormDataOptions): PreparedAudioFormData {
    const { audioFilePath, includeTimestamps, language, additionalFields } = options;

    validateAudioFile(audioFilePath);

    const audioBuffer = fs.readFileSync(audioFilePath);
    const fileName = extractFileName(audioFilePath);
    const boundary = generateFormBoundary();

    const formData = buildMultipartFormData({
        boundary,
        audioBuffer,
        fileName,
        includeTimestamps,
        language,
        additionalFields,
    });

    return { boundary, formData, fileName };
}

/**
 * Creates multipart form data with a generated test audio for API testing.
 * Generates a 1-second WAV file at 16kHz mono with a simple tone pattern
 * that simulates speech-like sound, directly as form data without writing to disk.
 *
 * @returns Object containing the boundary and prepared form data
 */
export function createTestAudioFormData(): PreparedAudioFormData {
    const sampleRate = 16000;
    const duration = 1;
    const numSamples = sampleRate * duration;
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const fileSize = 36 + dataSize;

    const audioBuffer = Buffer.alloc(44 + dataSize);
    let offset = 0;

    // RIFF header
    audioBuffer.write('RIFF', offset); offset += 4;
    audioBuffer.writeUInt32LE(fileSize, offset); offset += 4;
    audioBuffer.write('WAVE', offset); offset += 4;

    // fmt chunk
    audioBuffer.write('fmt ', offset); offset += 4;
    audioBuffer.writeUInt32LE(16, offset); offset += 4;
    audioBuffer.writeUInt16LE(1, offset); offset += 2;
    audioBuffer.writeUInt16LE(numChannels, offset); offset += 2;
    audioBuffer.writeUInt32LE(sampleRate, offset); offset += 4;
    audioBuffer.writeUInt32LE(byteRate, offset); offset += 4;
    audioBuffer.writeUInt16LE(blockAlign, offset); offset += 2;
    audioBuffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data chunk
    audioBuffer.write('data', offset); offset += 4;
    audioBuffer.writeUInt32LE(dataSize, offset); offset += 4;

    // Generate audio data with speech-like pattern
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const freq1 = 200 + Math.sin(t * 10) * 50;
        const freq2 = 800 + Math.sin(t * 15) * 100;
        const freq3 = 2400;
        const envelope = Math.sin(t * Math.PI) * 0.3;
        const sample = envelope * (
            Math.sin(2 * Math.PI * freq1 * t) * 0.5 +
            Math.sin(2 * Math.PI * freq2 * t) * 0.3 +
            Math.sin(2 * Math.PI * freq3 * t) * 0.2
        );
        audioBuffer.writeInt16LE(Math.floor(sample * 32767), offset);
        offset += 2;
    }

    const fileName = 'test-audio.wav';
    const boundary = generateFormBoundary();
    const formData = buildMultipartFormData({
        boundary,
        audioBuffer,
        fileName,
        includeTimestamps: false,
    });

    return { boundary, formData, fileName };
}
