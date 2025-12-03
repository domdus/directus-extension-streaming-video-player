import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'interface-video-player',
	name: 'Streaming Video Player',
	icon: 'play_circle',
	description: 'Play HLS (m3u8) video streams and standard video files (mp4, etc.) with this enhanced video player interface',
	component: InterfaceComponent,
	types: ['uuid', 'string'],
	localTypes: ['file', 'standard'],
	group: 'relational',
	relational: true,
	options: ({ relations, field }) => {
		// If relations exists, it's a file field - show file field options
		// If relations doesn't exist, it's a string field - show input interface options + video player options
		if (!relations || !relations.m2o) {
			// Numeric types (for future support)
			const APP_NUMERIC_TYPES = ['bigInteger', 'integer', 'float', 'decimal'];
			const isNumeric = field?.type && APP_NUMERIC_TYPES.includes(field.type);
			
			// Field options
			const streamingConfigGroup = {
				field: 'streaming_config',
				name: 'Streaming Configuration',
				type: 'alias' as const,
				schema: null,
				meta: {
					field: 'streaming_config',
					width: 'full' as const,
					interface: 'group-detail',
					special: ['alias', 'no-data', 'group'],
					options: {
						start: 'collapsed'
					}
				}
			};
			
			const fieldOptionsGroup = {
				field: 'field_options',
				name: 'Field Options',
				type: 'alias' as const,
				schema: null,
				meta: {
					field: 'field_options',
					width: 'full' as const,
					interface: 'group-detail',
					special: ['alias', 'no-data', 'group'],
					options: {
						start: 'collapsed'
					}
				}
			};
			
			const fieldOptions = [
				{
					field: 'placeholder',
					name: '$t:placeholder',
					meta: {
						width: 'full' as const,
						interface: 'system-input-translated-string',
						group: 'field_options',
						options: {
							placeholder: '$t:enter_a_placeholder',
						},
					},
				},
				{
					field: 'iconLeft',
					name: '$t:icon_left',
					type: 'string' as const,
					meta: {
						width: 'half' as const,
						interface: 'select-icon',
						group: 'field_options',
					},
				},
				{
					field: 'iconRight',
					name: '$t:icon_right',
					type: 'string' as const,
					meta: {
						width: 'half' as const,
						interface: 'select-icon',
						group: 'field_options',
					},
				},
				{
					field: 'softLength',
					name: '$t:soft_length',
					type: 'integer' as const,
					meta: {
						width: 'half' as const,
						interface: 'input',
						group: 'field_options',
						options: {
							placeholder: '255',
							min: 1,
							max: field?.schema?.max_length,
						},
					},
				},
				{
					field: 'font',
					name: '$t:font',
					type: 'string' as const,
					meta: {
						width: 'half' as const,
						interface: 'select-dropdown',
						group: 'field_options',
						options: {
							choices: [
								{ text: '$t:sans_serif', value: 'sans-serif' },
								{ text: '$t:monospace', value: 'monospace' },
								{ text: '$t:serif', value: 'serif' },
							],
						},
					},
					schema: {
						default_value: 'sans-serif',
					},
				},
				{
					field: 'trim',
					name: '$t:interfaces.input.trim',
					type: 'boolean' as const,
					meta: {
						width: 'half' as const,
						interface: 'boolean',
						group: 'field_options',
						options: {
							label: '$t:interfaces.input.trim_label',
						},
					},
					schema: {
						default_value: false,
					},
				},
				{
					field: 'masked',
					name: '$t:interfaces.input.mask',
					type: 'boolean' as const,
					meta: {
						width: 'half' as const,
						interface: 'boolean',
						group: 'field_options',
						options: {
							label: '$t:interfaces.input.mask_label',
						},
					},
					schema: {
						default_value: false,
					},
				},
				{
					field: 'clear',
					name: '$t:interfaces.input.clear',
					type: 'boolean' as const,
					meta: {
						width: 'half' as const,
						interface: 'boolean',
						group: 'field_options',
						options: {
							label: '$t:interfaces.input.clear_label',
						},
					},
					schema: {
						default_value: false,
					},
				},
				{
					field: 'slug',
					name: '$t:interfaces.input.slug',
					type: 'boolean' as const,
					meta: {
						width: 'half' as const,
						interface: 'boolean',
						group: 'field_options',
						options: {
							label: '$t:interfaces.input.slug_label',
						},
					},
					schema: {
						default_value: false,
					},
				},
			];
			
			// Video player specific options
			const hostUrlOption = {
				field: 'host_url',
				name: 'Host URL',
				type: 'string' as const,
				meta: {
					width: 'full' as const,
					interface: 'input',
					group: 'streaming_config',
					options: {
						placeholder: typeof window !== 'undefined' ? window.location.origin : ''
					},
					note: 'Optional: Set Host URL to combine with relative paths from collection field (e.g. domain + /path/to/video.m3u8). Leave empty when working with fully qualified URLs in collection field. Use mustache template syntax for secured links with {{token}} and {{expires}} placeholders (e.g., https://example.com/stream/hls/{{token}}/{{expires}}).'
				}
			};
			
			const streamSecretOption = {
				field: 'stream_secret',
				name: 'Stream Secret',
				type: 'string' as const,
				meta: {
					width: 'full' as const,
					interface: 'input',
					group: 'streaming_config',
					options: {
						placeholder: 'Enter stream secret for HLS token generation',
						secret: true
					},
					note: 'Secret key used for generating secure HLS stream tokens'
				}
			};

			// Info notice at the top
			const infoNotice = {
				field: 'info-notice',
				name: 'Info',
				type: 'alias' as const,
				schema: null,
				meta: {
					width: 'full' as const,
					interface: 'presentation-notice',
					special: ['alias', 'no-data'],
					options: {
						text: 'Setup complete for basic usage',
						color: 'info'
					}
				}
			};
			
			const posterImageFieldNameOption = {
				field: 'poster_image_field_name',
				name: 'Poster Image Field Name',
				type: 'string' as const,
				meta: {
					width: 'full' as const,
					interface: 'input',
					group: 'streaming_config',
					options: {
						placeholder: 'image'
					},
					note: 'Optional: Name of the field that contains the poster image. Can be a file field (UUID) or string field (full URL)'
				},
				schema: {
					default_value: 'image'
				}
			};
			
			// Return all options for string fields (video player options first)
			return [
				infoNotice,
				posterImageFieldNameOption,
				hostUrlOption,
				streamingConfigGroup,
				streamSecretOption,
				fieldOptionsGroup,
				...fieldOptions
			];
		}

		const collection = relations.m2o?.related_collection;

		const hostUrlOption = {
			field: 'host_url',
			name: 'Host URL',
			type: 'string' as const,
			meta: {
				width: 'full' as const,
				interface: 'input',
				group: 'streaming_config',
				options: {
					placeholder: typeof window !== 'undefined' ? window.location.origin : ''
				},
				note: 'Optional: Set Host URL to combine with relative paths from collection field (e.g. domain + /path/to/video.m3u8). Leave empty when working with fully qualified URLs in collection field. Use mustache template syntax for secured links with {{token}} and {{expires}} placeholders (e.g., https://example.com/stream/hls/{{token}}/{{expires}}). '
			}
		};
		
		const streamingConfigGroup = {
			field: 'streaming_config',
			name: 'Streaming Configuration',
			type: 'alias' as const,
			schema: null,
			meta: {
				field: 'streaming_config',
				width: 'full' as const,
				interface: 'group-detail',
				special: ['alias', 'no-data', 'group'],
				options: {
					start: 'collapsed'
				}
			}
		};
		
		const streamSecretOption = {
			field: 'stream_secret',
			name: 'Stream Secret',
			type: 'string' as const,
			meta: {
				width: 'full' as const,
				interface: 'input',
				group: 'streaming_config',
				options: {
					placeholder: 'Enter stream secret for HLS token generation',
					secret: true
				},
				note: 'Secret key used for generating secure HLS stream tokens'
			}
		};
		
		const streamLinkFieldNameOption = {
			field: 'stream_link_field_name',
			name: 'Stream Link Field Name',
			type: 'string' as const,
			meta: {
				width: 'full' as const,
				interface: 'input',
				group: 'streaming_config',
				options: {
					placeholder: 'Name of the field in directus_files collection'
				},
				note: 'When storing stream links in a directus_files field - set the name of it here'
			},
			schema: {
				default_value: ''
			}
		};
		
		const posterImageFieldNameOption = {
			field: 'poster_image_field_name',
			name: 'Poster Image Field Name',
			type: 'string' as const,
			meta: {
				width: 'full' as const,
				interface: 'input',
				group: 'streaming_config',
				options: {
					placeholder: 'image'
				},
				note: 'Optional: Name of the field that contains the poster image. Can be a file field (UUID) or string field (full URL).'
			},
			schema: {
				default_value: 'image'
			}
		};
		
		const fieldOptionsGroup = {
			field: 'field_options',
			name: 'Field Options',
			type: 'alias' as const,
			schema: null,
			meta: {
				field: 'field_options',
				width: 'full' as const,
				interface: 'group-detail',
				group: null,
				special: ['alias', 'no-data', 'group'],
				options: {
					start: 'collapsed'
				}
			}
		};
		
		// Info notice at the top
		const infoNotice = {
			field: 'info-notice',
			name: 'Info',
			type: 'alias' as const,
			schema: null,
			meta: {
				width: 'full' as const,
				interface: 'presentation-notice',
				special: ['alias', 'no-data'],
				options: {
					text: 'Setup complete for basic usage',
					color: 'info'
				}
			}
		};
		
		return [
			infoNotice,
			posterImageFieldNameOption,
			hostUrlOption,
			streamingConfigGroup,
			streamSecretOption,
			streamLinkFieldNameOption,
			fieldOptionsGroup,
			{
				field: 'folder',
				name: '$t:interfaces.system-folder.folder',
				type: 'uuid',
				meta: {
					width: 'full',
					interface: 'system-folder',
					group: 'field_options',
					note: '$t:interfaces.system-folder.field_hint',
				},
			},
			{
				field: 'filter',
				name: '$t:filter',
				type: 'json',
				meta: {
					interface: 'system-filter',
					group: 'field_options',
					options: {
						collectionName: collection,
					},
				},
			},
			{
				field: 'enableCreate',
				name: '$t:creating_items',
				schema: {
					default_value: true,
				},
				meta: {
					interface: 'boolean',
					group: 'field_options',
					options: {
						label: '$t:enable_create_button',
					},
					width: 'half',
				},
			},
			{
				field: 'enableSelect',
				name: '$t:selecting_items',
				schema: {
					default_value: true,
				},
				meta: {
					interface: 'boolean',
					group: 'field_options',
					options: {
						label: '$t:enable_select_button',
					},
					width: 'half',
				},
			}
		];
	},
});
