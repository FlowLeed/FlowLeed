export interface OperatorOption {
  value: string;
  label: string;
}

export interface FieldWithOptions {
  dataType: string;
  options?: string[];
}

// Build combined dropdown options based on field type
export function getCombinedOptionsForField(field: FieldWithOptions): OperatorOption[] {
  const dataType = field.dataType.toLowerCase(); // Normalize to lowercase
  
  // Log for debugging (can remove later)
  if (field.options && field.options.length > 0) {
    console.log(`Field with options has dataType: "${field.dataType}"`);
  }
  
  switch (dataType) {
    // Simple fields: only "Has any value"
    case 'text':
    case 'string':
    case 'paragraph':
    case 'textarea':
    case 'number':
    case 'integer':
    case 'decimal':
    case 'date':
    case 'date_picker':
    case 'file':
    case 'attachment':
    case 'section_header':
    case 'header':
      return [{ value: 'is_not_empty', label: 'Has any value' }];
    
    // Yes/No fields: Yes, No, Empty
    case 'checkbox':
    case 'yes_no':
    case 'boolean':
      return [
        { value: 'is_yes', label: 'Yes' },
        { value: 'is_no', label: 'No' },
        { value: 'is_empty', label: 'Empty' },
      ];
    
    // Dropdown/Checkboxes: only show actual option values
    case 'dropdown':
    case 'select':
    case 'single_select':
    case 'string_select':
    case 'checkboxes':
    case 'multi_select':
    case 'multiple_select':
    case 'multiselect':
      // Show actual options plus "Has any value"
      if (field.options && field.options.length > 0) {
        return [
          ...field.options.map(option => ({
            value: `option:${option}`,
            label: option,
          })),
          { value: 'is_not_empty', label: 'Has any value' },
        ];
      }
      return [{ value: 'is_not_empty', label: 'Has any value' }];
    
    default:
      console.warn(`Unhandled dataType: "${field.dataType}". Showing basic options.`);
      // For unknown types with options, show them
      if (field.options && field.options.length > 0) {
        return field.options.map(option => ({
          value: `option:${option}`,
          label: option,
        }));
      }
      // Otherwise default to has any value
      return [{ value: 'is_not_empty', label: 'Has any value' }];
  }
}

// Check if additional input (date picker, text field) is needed
export function needsAdditionalInput(selectedValue: string, dataType: string): boolean {
  if (dataType === 'date' && selectedValue === 'equals') return true;
  if (['text', 'paragraph', 'number'].includes(dataType) && selectedValue === 'equals') return true;
  return false;
}

// Encode combined dropdown value to database format
export function encodeTriggerCondition(selectedValue: string, additionalValue: string | null): { operator: string; value: string | null } {
  // Handle option selections (dropdown/checkboxes)
  if (selectedValue.startsWith('option:')) {
    return {
      operator: 'equals',
      value: selectedValue.substring(7), // Remove "option:" prefix
    };
  }
  
  // Handle yes/no with new operators
  if (selectedValue === 'is_yes') {
    return { operator: 'is_truthy', value: null };
  }
  if (selectedValue === 'is_no') {
    return { operator: 'is_falsy', value: null };
  }
  if (selectedValue === 'is_empty') {
    return { operator: 'is_empty', value: null };
  }
  
  // Handle "has any value" / "file exists"
  if (selectedValue === 'is_not_empty') {
    return { operator: 'is_not_empty', value: null };
  }
  
  // Handle "equals" with additional input (date or text)
  if (selectedValue === 'equals') {
    return { operator: 'equals', value: additionalValue };
  }
  
  return { operator: selectedValue, value: additionalValue };
}

// Decode database format to combined dropdown value
export function decodeTriggerCondition(
  operator: string,
  value: string | null,
  field: FieldWithOptions
): { selectedValue: string; additionalValue: string | null } {
  // Handle new yes/no operators
  if (operator === 'is_truthy') {
    return { selectedValue: 'is_yes', additionalValue: null };
  }
  if (operator === 'is_falsy') {
    return { selectedValue: 'is_no', additionalValue: null };
  }
  if (operator === 'is_empty') {
    return { selectedValue: 'is_empty', additionalValue: null };
  }
  
  // Handle legacy yes/no fields (backwards compatibility)
  if ((field.dataType === 'checkbox' || field.dataType === 'yes_no') && operator === 'equals') {
    return {
      selectedValue: value === 'Yes' ? 'is_yes' : 'is_no',
      additionalValue: null,
    };
  }
  
  // Handle dropdown/checkboxes with specific option
  if (operator === 'equals' && value) {
    // Check if this is an option field
    if (field.options && field.options.length > 0 && field.options.includes(value)) {
      return {
        selectedValue: `option:${value}`,
        additionalValue: null,
      };
    }
  }
  
  // Handle "has any value"
  if (operator === 'is_not_empty') {
    return {
      selectedValue: 'is_not_empty',
      additionalValue: null,
    };
  }
  
  return {
    selectedValue: operator,
    additionalValue: value,
  };
}

// Get human-readable label for display
export function getTriggerLabel(selectedValue: string, additionalValue: string | null): string {
  if (selectedValue.startsWith('option:')) {
    return selectedValue.substring(7); // Just the option name
  }
  
  if (selectedValue === 'is_yes') return 'Yes';
  if (selectedValue === 'is_no') return 'No';
  if (selectedValue === 'is_empty') return 'Empty';
  if (selectedValue === 'is_not_empty') return 'Has any value';
  
  if (selectedValue === 'equals' && additionalValue) {
    return `Equals "${additionalValue}"`;
  }
  
  return selectedValue;
}

// Legacy functions for backward compatibility
export function getOperatorsForFieldType(dataType: string): OperatorOption[] {
  return getCombinedOptionsForField({ dataType, options: [] });
}

export function needsValueInput(operator: string): boolean {
  return operator !== 'is_not_empty' && operator !== 'is_yes' && operator !== 'is_no';
}

export function getOperatorLabel(operator: string): string {
  const labelMap: Record<string, string> = {
    equals: 'Equals',
    not_equals: 'Does not equal',
    is_not_empty: 'Has any value',
    is_yes: 'Is Yes',
    is_no: 'Is No',
  };
  return labelMap[operator] || operator;
}
