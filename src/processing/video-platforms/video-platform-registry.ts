import { VideoPlatformHandler } from './video-platform-handler';
import { YouTubeHandler } from './youtube-handler';
import { TikTokHandler } from './tiktok-handler';

/**
 * Registry for video platform handlers.
 * Provides a centralized way to register platform handlers and automatically
 * select the appropriate handler based on a URL.
 */
export class VideoPlatformRegistry {
    private handlers: VideoPlatformHandler[] = [];

    /**
     * Creates a new registry with the default set of handlers.
     */
    constructor() {
        this.registerDefaults();
    }

    /**
     * Registers the default set of platform handlers.
     */
    private registerDefaults(): void {
        this.register(new YouTubeHandler());
        this.register(new TikTokHandler());
    }

    /**
     * Registers a new platform handler.
     * @param handler - The handler to register
     */
    register(handler: VideoPlatformHandler): void {
        // Avoid duplicate registration
        if (!this.handlers.some(h => h.platformId === handler.platformId)) {
            this.handlers.push(handler);
        }
    }

    /**
     * Finds the appropriate handler for a given URL.
     * Searches through registered handlers and returns the first one that matches.
     * @param url - The video URL to find a handler for
     * @returns The matching handler or undefined if no handler matches
     */
    findHandlerForUrl(url: string): VideoPlatformHandler | undefined {
        return this.handlers.find(handler => handler.matchesUrl(url));
    }

    /**
     * Checks if a URL is a valid video URL supported by any registered handler.
     * @param url - The URL to validate
     * @returns True if the URL is valid for any registered platform
     */
    isValidVideoUrl(url: string): boolean {
        return this.handlers.some(handler => handler.isValidVideoUrl(url));
    }
}

/**
 * Singleton instance of the video platform registry.
 * Use this for most cases to avoid creating multiple registries.
 */
export const videoPlatformRegistry = new VideoPlatformRegistry();

