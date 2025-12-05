# Streaming Video Player

Play HLS adaptive video streams and standard video files in Directus with a customizable video player interface.

<img alt="screenshot_player" src="https://raw.githubusercontent.com/domdus/directus-extension-streaming-video-player/main/docs/screenshot_player.png" />

## Overview

This extension adds a video player interface to Directus allowing you to play videos on collection item detail views of the Data Studio. The player is able to play local or remote adaptive HLS streams (e.g., from Cloudflare Stream), as well as standard video files (MP4, etc.). It works with both string fields (for stream links) and Directus files (uploaded videos).

## Features

- **Videos in Items**: Play videos on collection items detail page
- **Adaptive HLS Streaming**: Play adaptive HLS video streams (m3u8)
- **Standard Videos**: Support for MP4 and other standard video formats
- **File Upload**: Uses Directus native drap & drop upload component known from default image interface
- **File Module Integration**: HLS streaming on Directus file detail pages (instead of progressive download)
- **Keeps Native Interface Options**:
  - Default upload folder & filter for files
  - Directus native options for input fields. 
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

### String Fields (Stream Links)

Use this interface on string fields to play HLS stream links:

1. Go to your collection settings
2. Select a string field
3. Set the interface to **Streaming Video Player**
4. In collection item view: Enter HLS stream paths for local origin resources (e.g., `/assets/:UUID`) or full URLs for remote/other resources (e.g., Cloudflare: https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/manifest/video.m3u8)

<img alt="screenshot_stream_link" src="https://raw.githubusercontent.com/domdus/directus-extension-streaming-video-player/main/docs/screenshot_stream_link.png" />

### Directus Files (Local Videos)

Use this interface on relational file fields to play uploaded video files:

1. Go to your collection settings
2. Select a file field (UUID type)
3. Set the interface to **Streaming Video Player**
4. In collection item view: Upload or select video file

The player supports MP4 and other standard video formats.

### File Module Integration

You may want to keep your stream links next to your source Directus files (videos). When applied to a custom string field in the `directus_files` collection, this extension will replace the default video player in the file detail page and prefer playing the HLS stream:

1. Add a string field to `directus_files` (e.g., `stream_link`)
2. Set the interface to **Streaming Video Player**
3. In directus_files item detail view: Enter stream link in the custom field and it will be picked up by the player

Use the toggle button to switch between HLS stream and source file playback.


<img alt="screenshot_files_detail_hls" src="https://raw.githubusercontent.com/domdus/directus-extension-streaming-video-player/main/docs/screenshot_files_detail_hls.png" /> <img alt="screenshot_files_detail_file" src="https://raw.githubusercontent.com/domdus/directus-extension-streaming-video-player/main/docs/screenshot_files_detail_file.png" />

## Configuration

- **Poster Image Field Name**: Name of the field that contains a poster/thumbnail image for player. It must be a file field (image) for uploaded images or a string field containing a full image URL. If not configured.
- **Stream Link Field Name**: (File field only) Name of a custom field in relational `directus_files` that contains the stream link. This enables the player to play the relational file HLS stream on a collection item detail page, instead of playing the source video file.

### Streaming Configuration 

- **Host URL**: Host domain (e.g., `https://example.com`). Default is the local Directus URL. Leave empty when working with fully qualified URLs in collection item field.
- **Stream Secret**: (Optional) Secret key for generating tokens for protected stream links if your streaming backend requires it. Further reading: https://nginx.org/en/docs/http/ngx_http_secure_link_module.html
  - Token/MD5 hash: `{token_expiration_time} + {ip (optional)} + {secret}`
- **URL Schema**: (Optional) URL template with mustache syntax placeholders for advanced construction of protected stream links. Available placeholders:
  - `{{host_url}}` - Host URL value
  - `{{token}}` - Generated secure token (requires Stream Secret)
  - `{{expires}}` - Expiration timestamp (requires Stream Secret)
  - `{{item_field}}` - Value from the collection item field
  
  **Example:**
  - Host URL: `https://example.com/stream/`
  - Item field value: `my_playlist.m3u8`
  - URL Schema: `{{host_url}}{{token}}/{{expires}}/{{item_field}}`
  - Player link: `https://example.com/stream/RO0G0oaX3n6eGMWWmKPiUw/1764939309/my_playlist.m3u8`

  **Default behavior (when URL Schema is not set):**
  - Host URL: `https://example.com`
  - Item field value: `/stream/my_video.m3u8`
  - Player link: `https://example.com/stream/my_video.m3u8`

- **Token Expiration (minutes)**: Token expiration time in minutes (default: 60)
- **Include IP**: Include client IP address in secure token generation for client-unique stream link protection (optional, default: false)


## Screenshots

<img alt="screenshot_string" src="https://raw.githubusercontent.com/domdus/directus-extension-streaming-video-player/main/docs/screenshot_string.png" /> <img alt="screenshot_string" src="https://raw.githubusercontent.com/domdus/directus-extension-streaming-video-player/main/docs/screenshot_files_2.png" />

## License

MIT
