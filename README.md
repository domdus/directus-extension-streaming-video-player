# Streaming Video Player

Play HLS adaptive video streams and standard video files directly in Directus with a customizable video player interface.

<img width="511" height="309" alt="screenshot_player" src="https://raw.githubusercontent.com/domdus/directus-extension-streaming-video-player/main/docs/screenshot_player.png" />

## Overview

This extension adds a video player interface to your Directus collection item views, allowing you to play adaptive HLS local or remote streams (e.g., from Cloudflare Stream) and standard video files (MP4, etc.) directly in the Data Studio. It works with both string fields (for stream links) and Directus files (for uploaded videos).

## Features

- **Videos in Items**: Play videos on collection items detail page
- **HLS Streaming**: Play HLS (m3u8) adaptive video streams
- **File Module Integration**: Enable HLS streaming instead of progressive download on file detail page
- **Standard Video Playback**: Support for MP4 and other standard video formats
- **File Upload**: Uses Directus native drap & drop upload component for file relations
- **Interface Options**:
  - Default upload folder & filter for files
  - Directus options for input fields. 
- **Poster Images**: Display poster images for video previews
- **Native Player**: Full-featured HTML5 video player with controls, no fancy themes, small footprint

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
4. In collection item view: Enter HLS stream paths for local origin resources (e.g., `/assets/:uid`) or full URLs for remote/other resources (e.g., Cloudflare: https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/manifest/video.m3u8)

### For Files Relation (Local Videos)

Use this interface on relational file fields to play uploaded video files:

1. Go to your collection settings
2. Select a file field (UUID type)
3. Set the interface to **Streaming Video Player**
4. In collection item view: Upload or select video file

The player supports MP4 and other standard video formats.

### File Module Integration

When applied to a custom string field in the `directus_files` collection, this extension will replace the default video player in the file detail page and prefere the HLS stream link:

1. Add a string field to `directus_files` (e.g., `stream_link`)
2. Set the interface to **Streaming Video Player**
3. In directus_files item view: Enter stream link in the custom field and it will be picked up by the player

Use the toggle button to switch between HLS stream and source file playback.

## Configuration

### Streaming Configuration 

When using the interface on file fields, you can configure:

- **Stream Link Field Name**: (File field only) Name of a custom field in `directus_files` that contains the stream link. This enables the player to play the relational file HLS stream on a collection item detail page, instead of playing the source video file. (no streaming)
- **Poster Image Field Name**: Name of the field that contains the poster/thumbnail image. Can be a file field (UUID) for uploaded images or a string field containing a full image URL. If not configured, defaults to `image`.
- **Host URL**: Base URL for constructing stream URLs. Default is `localhost`. The host URL can combined with relative paths from collection items to create full stream URLs.

  **Examples:**
  
  1. Custom streaming server:
     - Host URL: `https://stream.example.com`
     - Item field value: `/stream/my_video.m3u8`
     - Player plays: `https://stream.example.com/stream/my_video.m3u8`
  
  2. Cloudflare Stream:
     - Host URL: `https://customer-f33zs165nr7gyfy4.cloudflarestream.com`
     - Item field value: `/6b9e68b07dfee8cc2d116e4c51d6a957/manifest/video.m3u8`
     - Player plays: `https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/manifest/video.m3u8`


- **Stream Secret**: Secret key for generating tokens for protected stream link (optional)


## Screenshots

_Screenshots will be added here showing the player in different contexts._

## Requirements

- Directus 10.1.14 or higher
- Modern web browser with HTML5 video support

## License

MIT
