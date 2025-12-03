/**
 * Composable for field type detection and related computed properties
 */
import { computed, type ComputedRef } from 'vue';
import { useAttrs } from 'vue';
import type { useFileData } from './useFileData';
import type { useStreamUrl } from './useStreamUrl';

export function useFieldDetection(
	props: any,
	attrs: any,
	fileData: ReturnType<typeof useFileData>['fileData'],
	streamLinkFieldName: ComputedRef<string>,
	getStreamUrl: (streamLink: string) => string | null,
	apiBaseUrl: ComputedRef<string>,
	values: any
) {
	// Detect if this is a string field (not a file field)
	const isStringField = computed(() => {
		// Check if fieldMeta indicates it's a string type, or if localType is 'standard'
		const localType = (attrs['local-type'] as string) || (attrs.localType as string);
		const fieldType = props.fieldMeta?.type;
		const fieldDataType = (attrs as any).type; // Direct type from attrs
		
		// If localType is 'file', it's definitely a file field
		if (localType === 'file') {
			return false;
		}
		
		// Primary check: localType is the most reliable indicator
		if (localType === 'standard') {
			return true;
		}
		
		// Check field type from multiple sources
		if (fieldType === 'string' || fieldDataType === 'string') {
			return true;
		}
		
		// Check if we have a relation (m2o) - if yes, it's a file field
		if ((attrs as any).m2o || (attrs as any).relations) {
			return false;
		}
		
		// Check if the field is a UUID type (file fields are usually UUID)
		// String fields are never UUID
		if (fieldType === 'uuid' || fieldDataType === 'uuid') {
			return false;
		}
		
		// If we're in file module and field matches the configured stream link field name, it's a string field
		// Only check if streamLinkFieldName is configured (not empty)
		if (props.collection === 'directus_files' && streamLinkFieldName.value && props.field === streamLinkFieldName.value) {
			return true;
		}
		
		// If we can't determine, check if value looks like a file ID (UUID) vs a string path
		// File IDs are UUIDs, string paths start with /
		if (props.value && typeof props.value === 'string') {
			// If it starts with /, it's likely a string path (HLS stream path)
			if (props.value.startsWith('/')) {
				return true;
			}
			// If it's a UUID format, it's likely a file ID
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			if (uuidRegex.test(props.value)) {
				return false;
			}
		}
		
		// Default: assume it's a file field if we can't determine
		return false;
	});

	// Detect if we're in the file module
	const isFileModule = computed(() => {
		return props.collection === 'directus_files';
	});

	// Check if we should replace the default video player
	const shouldReplaceDefaultPlayerComputed = computed(() => {
		if (!isFileModule.value || !isStringField.value || !props.value) {
			return false;
		}
		
		// If streamLinkFieldName is configured, only replace if field matches
		if (streamLinkFieldName.value) {
			return props.field === streamLinkFieldName.value;
		}
		
		// If not configured, replace for any string field in file module (backward compatibility)
		return true;
	});

	const isVideoFile = computed(() => {
		// For string fields, we assume it's a video if we have a stream URL
		if (isStringField.value) {
			return !!props.value;
		}
		if (!fileData.value?.type) return false;
		return fileData.value.type.startsWith('video/');
	});

	// Get stream URL - either from string field value or from fileData
	const streamUrlFromValue = computed(() => {
		if (isStringField.value && props.value) {
			return getStreamUrl(props.value);
		}
		// Only check for stream link if field name is configured
		if (streamLinkFieldName.value) {
			const streamLinkValue = fileData.value?.[streamLinkFieldName.value];
			if (streamLinkValue) {
				return getStreamUrl(streamLinkValue);
			}
		}
		return null;
	});

	// Get MP4 URL for file module
	const mp4Url = computed(() => {
		// For string fields in file module (replacement player case), get MP4 URL from file ID
		if (isFileModule.value && isStringField.value && shouldReplaceDefaultPlayerComputed.value) {
			// Get file ID from context - try multiple ways
			let fileId: string | null = null;
			
			// Try primaryKey from attrs
			if ((attrs as any).primaryKey) {
				fileId = (attrs as any).primaryKey;
			}
			// Try primary-key from attrs (kebab-case)
			else if ((attrs as any)['primary-key']) {
				fileId = (attrs as any)['primary-key'];
			}
			// Try item.id from attrs
			else if ((attrs as any).item?.id) {
				fileId = (attrs as any).item.id;
			}
			// Try values.id (injected values)
			else if (values.value?.id) {
				fileId = values.value.id;
			}
			// Try to extract from URL path
			else if (typeof window !== 'undefined') {
				const match = window.location.pathname.match(/\/files\/([^\/]+)/);
				if (match && match[1]) {
					fileId = match[1];
				}
			}
			
			if (fileId) {
				const baseUrl = apiBaseUrl.value.endsWith('/') ? apiBaseUrl.value.slice(0, -1) : apiBaseUrl.value;
				return `${baseUrl}/assets/${fileId}`;
			}
		}
		
		// For string fields NOT replacing default player, we can't get MP4 URL from file ID
		// (they only have stream paths, not file IDs)
		// Return null - MP4 switching won't work for these
		if (isStringField.value && !shouldReplaceDefaultPlayerComputed.value) {
			return null;
		}
		
		// For file fields, use videoUrl
		if (!isStringField.value && videoUrl.value) {
			return videoUrl.value;
		}
		
		return null;
	});

	// Get the poster image field name from options
	const posterImageFieldName = computed(() => {
		return (attrs.poster_image_field_name as string);
	});

	const posterUrl = computed(() => {
		// Don't try to get poster when replacing default player in file module
		// Note: shouldReplaceDefaultPlayer is computed below, but we check isFileModule and isStringField here
		if (isFileModule.value && isStringField.value && props.value) {
			return null;
		}
		
		// Get the configured poster image field name
		const fieldName = posterImageFieldName.value;
		if (!fieldName) {
			return null;
		}
		
		// Try to get poster image field from the collection item using injected values
		const posterValue = values.value?.[fieldName];
		if (!posterValue) {
			return null;
		}
		
		// Check if it's a full URL (string field)
		if (typeof posterValue === 'string') {
			// Check if it's a full URL (starts with http:// or https://)
			if (posterValue.startsWith('http://') || posterValue.startsWith('https://')) {
				return posterValue;
			}
			// Otherwise, treat it as a file ID (UUID)
			const baseUrl = apiBaseUrl.value.endsWith('/') ? apiBaseUrl.value.slice(0, -1) : apiBaseUrl.value;
			return `${baseUrl}/assets/${posterValue}?key=system-large-cover`;
		}
		
		// If it's an object, try to get the id property (file field)
		const imageId = (posterValue as any)?.id;
		if (imageId) {
			// Ensure we have a full URL - apiBaseUrl already includes protocol and host
			const baseUrl = apiBaseUrl.value.endsWith('/') ? apiBaseUrl.value.slice(0, -1) : apiBaseUrl.value;
			return `${baseUrl}/assets/${imageId}?key=system-large-cover`;
		}
		
		return null;
	});

	const videoUrl = computed(() => {
		if (!fileData.value?.id) return null;
		// Ensure we have a full URL - apiBaseUrl already includes protocol and host
		const baseUrl = apiBaseUrl.value.endsWith('/') ? apiBaseUrl.value.slice(0, -1) : apiBaseUrl.value;
		return `${baseUrl}/assets/${fileData.value.id}`;
	});

	const downloadUrl = computed(() => {
		if (!fileData.value?.id) return null;
		// Ensure we have a full URL - apiBaseUrl already includes protocol and host
		const baseUrl = apiBaseUrl.value.endsWith('/') ? apiBaseUrl.value.slice(0, -1) : apiBaseUrl.value;
		return `${baseUrl}/assets/${fileData.value.id}?download=`;
	});

	// Get folder from attrs or options
	const folder = computed(() => {
		return (attrs.folder as string) || props.folder || null;
	});

	// Get enableSelect and enableCreate from attrs or props
	const enableSelectValue = computed(() => {
		const fromAttrs = attrs.enableSelect as boolean | undefined;
		const fromProps = props.enableSelect;
		return fromAttrs !== undefined ? fromAttrs : (fromProps !== undefined ? fromProps : true);
	});

	const enableCreateValue = computed(() => {
		const fromAttrs = attrs.enableCreate as boolean | undefined;
		const fromProps = props.enableCreate;
		return fromAttrs !== undefined ? fromAttrs : (fromProps !== undefined ? fromProps : true);
	});

	// Get create permissions (simplified - you may need to implement proper permission checking)
	const createAllowed = computed(() => {
		return enableCreateValue.value !== false;
	});

	// Custom filter with template rendering
	const customFilter = computed(() => {
		if (!props.filter) return null;
		// Simple filter parsing - you may need more sophisticated parsing
		return props.filter;
	});

	return {
		isStringField,
		isFileModule,
		shouldReplaceDefaultPlayer: shouldReplaceDefaultPlayerComputed,
		isVideoFile,
		streamUrlFromValue,
		mp4Url,
		posterUrl,
		videoUrl,
		downloadUrl,
		folder,
		enableSelectValue,
		enableCreateValue,
		createAllowed,
		customFilter
	};
}

