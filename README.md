# LLM Toolbox

A personal collection of LLM tools to enhance the Obsidian.md workflow.

## Features

### Video Transcription

Transcribe videos from clipboard URLs directly into Obsidian notes:

- **Supported platforms**: YouTube, TikTok, and any video URL supported by `yt-dlp`
- **AI transcription**: Transcribes audio using Azure OpenAI Whisper API
- **Automatic note creation**: Creates formatted notes with transcriptions in your vault
- **Optional timestamps**: Include timestamps in transcriptions for easy reference

## Requirements

This plugin requires the following external tools to be installed on your system:

1. **yt-dlp**: For downloading videos and extracting audio
   - Install: https://github.com/yt-dlp/yt-dlp#installation

2. **ffmpeg**: For audio processing
   - Install: https://ffmpeg.org/download.html

3. **Azure OpenAI account**: For Whisper transcription API
   - You'll need an Azure OpenAI endpoint, API key, and Whisper deployment

4. **Ensure browser dependencies are installed**: 

```bash
pip install yt-dlp
pip install yt-dlp[curl_cffi]
```
**Note**: This plugin is desktop-only and will not work on mobile devices.

## How to Use

1. **Configure the plugin**:
   - Go to **Settings → LLM Toolbox**
   - Enter your Azure OpenAI endpoint, API key, and deployment name
   - Configure optional settings (timestamps, language, output folder)

2. **Transcribe a video**:
   - Copy a video URL to your clipboard (YouTube, TikTok, etc.)
   - Click the captions icon in the left ribbon
   - Wait for the plugin to download, extract audio, and transcribe
   - A new note will be created and opened with the transcription

## Installation

### Using BRAT

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) if you haven't already
2. Open **Settings → BRAT → Add Beta plugin**
3. Enter this repository ID: `dalinicus/obsidian-llm-toolbox`
4. Click **Add Plugin**
5. Enable the plugin in **Settings → Community plugins**

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/dalinicus/obsidian-llm-toolbox/releases)
2. Extract the files to your vault's plugins folder: `VaultFolder/.obsidian/plugins/llm-toolbox/`
3. Reload Obsidian
4. Enable the plugin in **Settings → Community plugins**

## Support

If you find this plugin helpful, consider supporting development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow.svg)](https://buymeacoffee.com/dalinicus)