/**
 * Composable for string field input handling
 */
import { ref, type Ref } from 'vue';
import type { InputOptions } from './useInputOptions';

export function useStringFieldHandlers(
	props: any,
	emit: (event: 'input', value: string | null) => void,
	inputOptions: Ref<InputOptions>,
	processValue: (value: string, options: InputOptions) => string
) {
	const isEditingStringField = ref(false);
	const editingValue = ref<string | null>(null);

	const editStringField = () => {
		// Initialize editingValue with current value
		editingValue.value = props.value || '';
		isEditingStringField.value = true;
	};

	const clearStringField = () => {
		// Clear both the editing value and emit to parent
		editingValue.value = null;
		emit('input', null);
		isEditingStringField.value = true; // Show input field after clearing
	};

	const handleStringInput = (newValue: string | null) => {
		// While editing, only update the local editingValue, don't emit to parent yet
		// This keeps the player showing the old value until save
		if (isEditingStringField.value) {
			if (newValue === null || newValue === undefined) {
				editingValue.value = null;
				return;
			}
			
			let processed = newValue;
			
			// Apply soft length limit if set
			if (inputOptions.value.softLength && processed.length > inputOptions.value.softLength) {
				processed = processed.substring(0, inputOptions.value.softLength);
			}
			
			editingValue.value = processed;
			return;
		}
		
		// If not in editing mode, emit immediately (for file module case)
		if (newValue === null || newValue === undefined) {
			const clearedValue = inputOptions.value.clear ? '' : null;
			emit('input', clearedValue);
			return;
		}
		
		let processed = newValue;
		
		// Process value using composable
		processed = processValue(processed, inputOptions.value);
		
		emit('input', processed);
	};

	const finishEditing = () => {
		if (!isEditingStringField.value) return;
		
		// Process the editing value and emit to parent
		let processed = editingValue.value;
		
		if (processed === null || processed === undefined) {
			// Handle clear option - if clear is true, emit empty string, otherwise null
			const clearedValue = inputOptions.value.clear ? '' : null;
			emit('input', clearedValue);
			isEditingStringField.value = false;
			return;
		}
		
		// Process value using composable
		processed = processValue(processed, inputOptions.value);
		
		// Emit the processed value to parent (this will update props.value after save)
		emit('input', processed);
		
		// Exit editing mode
		isEditingStringField.value = false;
	};

	// Watch for value changes (after save) to reset editing state
	const resetEditingState = () => {
		// If we were editing and the value changed (after save), exit editing mode
		if (isEditingStringField.value) {
			isEditingStringField.value = false;
			editingValue.value = null;
		}
	};

	return {
		isEditingStringField,
		editingValue,
		editStringField,
		clearStringField,
		handleStringInput,
		finishEditing,
		resetEditingState
	};
}

