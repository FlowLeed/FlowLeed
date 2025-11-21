export interface OperatorOption {
  value: string;
  label: string;
}

export function getOperatorsForFieldType(dataType: string): OperatorOption[] {
  switch (dataType) {
    case 'checkbox':  // Planning Center's name for yes/no fields
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
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Does not equal' },
      ];
    
    case 'file':
      return [{ value: 'is_not_empty', label: 'File exists' }];
    
    case 'text':
    case 'paragraph':
    case 'number':
      return [
        { value: 'is_not_empty', label: 'Has any value' },
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Does not equal' },
      ];
    
    default:
      return [{ value: 'equals', label: 'Equals' }];
  }
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
