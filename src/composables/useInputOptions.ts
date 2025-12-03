/**
 * Composable for handling input field options
 */
import { computed, type ComputedRef } from 'vue';
import { slugify } from '../utils';

export interface InputOptions {
	placeholder: string;
	iconLeft?: string;
	iconRight?: string;
	softLength?: number;
	font: 'sans-serif' | 'serif' | 'monospace';
	trim: boolean;
	masked: boolean;
	clear: boolean;
	slug: boolean;
}

export function useInputOptions(attrs: any) {
	const inputOptions: ComputedRef<InputOptions> = computed(() => {
		return {
			placeholder: (attrs.placeholder as string) || 'Enter full URL or relative path',
			iconLeft: attrs.iconLeft as string | undefined,
			iconRight: attrs.iconRight as string | undefined,
			softLength: attrs.softLength as number | undefined,
			font: (attrs.font as 'sans-serif' | 'serif' | 'monospace') || 'sans-serif',
			trim: (attrs.trim as boolean) ?? false,
			masked: (attrs.masked as boolean) ?? false,
			clear: (attrs.clear as boolean) ?? false,
			slug: (attrs.slug as boolean) ?? false,
		};
	});

	const inputPlaceholder = computed(() => {
		return inputOptions.value.placeholder;
	});

	const processValue = (value: string, options: InputOptions): string => {
		if (!value) return value;
		
		let processed = value;
		
		// Apply trim if enabled
		if (options.trim) {
			processed = processed.trim();
		}
		
		// Apply slugify if enabled
		if (options.slug) {
			processed = slugify(processed);
		}
		
		// Apply soft length limit if set
		if (options.softLength && processed.length > options.softLength) {
			processed = processed.substring(0, options.softLength);
		}
		
		return processed;
	};

	return {
		inputOptions,
		inputPlaceholder,
		processValue
	};
}

