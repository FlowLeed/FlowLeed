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
  switch (field.dataType) {
    case 'checkbox':
    case 'yes_no':
      return [
        { value: 'is_yes', label: 'Is Yes' },
        { value: 'is_no', label: 'Is No' },
      ];
    
    case 'date':
      return [
        { value: 'is_not_empty', label: 'Has any date' },
        { value: 'equals', label: 'Is specific date' },
      ];
    
    case 'dropdown':
    case 'checkboxes':
      return [
        { value: 'is_not_empty', label: 'Has any value' },
        ...(field.options || []).map(option => ({
          value: `option:${option}`,
          label: option,
        })),
      ];
    
    case 'file':
      return [{ value: 'is_not_empty', label: 'File exists' }];
    
    case 'text':
    case 'paragraph':
    case 'number':
      return [
        { value: 'is_not_empty', label: 'Has any value' },
        { value: 'equals', label: 'Equals specific value' },
      ];
    
    default:
      return [{ value: 'equals', label: 'Equals' }];
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
  
  // Handle yes/no
  if (selectedValue === 'is_yes') {
    return { operator: 'equals', value: 'Yes' };
  }
  if (selectedValue === 'is_no') {
    return { operator: 'equals', value: 'No' };
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
  // Handle yes/no fields
  if (field.dataType === 'checkbox' || field.dataType === 'yes_no') {
    return {
      selectedValue: value === 'Yes' ? 'is_yes' : 'is_no',
      additionalValue: null,
    };
  }
  
  // Handle dropdown/checkboxes with specific option
  if ((field.dataType === 'dropdown' || field.dataType === 'checkboxes') && operator === 'equals' && value) {
    return {
      selectedValue: `option:${value}`,
      additionalValue: null,
    };
  }
  
  // Handle "has any value" / "file exists"
  if (operator === 'is_not_empty') {
    return {
      selectedValue: 'is_not_empty',
      additionalValue: null,
    };
  }
  
  // Handle "equals" with specific date or text value
  if (operator === 'equals' && value) {
    return {
      selectedValue: 'equals',
      additionalValue: value,
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
  
  if (selectedValue === 'is_yes') return 'Is Yes';
  if (selectedValue === 'is_no') return 'Is No';
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
