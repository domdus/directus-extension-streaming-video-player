# Streaming Video Player

Play HLS adaptive video streams and standard video files directly in Directus with a customizable video player interface.

<img width="511" height="309" alt="image" src="https://github.com/domdus/directus-extension-streaming-video-player/blob/d456e7d0668d1f63545078133dc6261813011513/docs/screenshot_player.png" />

## Overview

This extension adds a video player interface to your Directus fields, allowing you to play adaptive HLS local or remote streams and standard video files (MP4, etc.) directly in the Data Studio. It works with both string fields (for stream links) and file fields (for uploaded videos).

## Installation

### Via Directus Marketplace

1. Open your Directus project
2. Navigate to **Settings** → **Extensions**
3. Click **Browse Marketplace**
4. Search for "Streaming Video Player"
5. Click **Install**

### Manual Installation

1. Copy the extension to your Directus extensions directory
2. Restart your Directus instance

To make HLS video sources work, update your CSP directives as follows:
```env
CONTENT_SECURITY_POLICY_DIRECTIVES__MEDIA_SRC=array:'self', blob: data:
```

## Usage

### For String Fields (Stream Links)

Use this interface on string fields to play HLS stream links:

1. Go to your collection settings
2. Select a string field
3. Set the interface to **Streaming Video Player**
4. (In collection item field) Enter HLS stream paths for local origin resources (e.g., `/assets/:uid.m3u8`) or full URLs for remote/other resources (e.g., Cloudflare Stream)

### For Files Relation (Video Files)

Use this interface on relational file fields to play uploaded video files:

1. Go to your collection settings
2. Select a file field (UUID type)
3. Set the interface to **Streaming Video Player**
4. (In collection item) Upload or select video files

The player supports MP4 and other standard video formats.

### File Module Integration

When applied to a string field in the `directus_files` collection, this extension will replace the default video player in the file detail page and prefere the HLS stream link:

1. Add a string field to `directus_files` (e.g., `stream_link`)
2. Set the interface to **Streaming Video Player**
3. Configure the field name in the interface options under **Streaming Configuration**
4. (In directus_files item) Enter stream link in the field and it will be picked up by the player

Use the toggle button to switch between HLS stream and source file playback.

## Configuration

### Streaming Configuration 

When using the interface on file fields, you can configure:

- **Stream Link Field Name**: (File Fields Only) Name of the field in `directus_files` that contains the stream link. This enables the player to play the HLS stream on a collection item detail page, instead of playing the source file. If not configured, the player will use the uploaded source video file (no streaming).
- **Poster Image Field Name**: Name of the field that contains the poster/thumbnail image. Can be a file field (UUID) for uploaded images or a string field containing a full image URL. If not configured, defaults to `image`.
- **Host URL**: Base URL for constructing stream URLs (supports `{{token}}` and `{{expires}}` placeholders for secure streams)
- **Stream Secret**: Secret key for generating secure stream tokens (optional)

### Input Field Options (String Fields Only)

When using the interface on string fields, all standard Directus input field options are available:
- Placeholder text
- Icons (left/right)
- Font family
- Soft length limit
- Trim whitespace
- Masked input
- Clear button
- Slugify

## Features

- **HLS Streaming**: Play HLS (m3u8) adaptive video streams
- **Standard Video Playback**: Support for MP4 and other standard video formats
- **Format Toggle**: Switch between HLS stream and source file playback (file module only)
- **Secure Streams**: Optional token-based authentication for secure stream URLs
- **Native Player**: Full-featured HTML5 video player with controls
- **Poster Images**: Display poster images for video previews

## Screenshots

_Screenshots will be added here showing the player in different contexts._

## Requirements

- Directus 10.1.14 or higher
- Modern web browser with HTML5 video support

## License

MIT
