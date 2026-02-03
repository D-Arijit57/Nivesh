import React from 'react'
import { FormControl, FormField, FormLabel, FormMessage } from './ui/form'
import { Input } from './ui/input'

import { Control, FieldPath } from 'react-hook-form'
import { z } from 'zod'
import { authFormSchema } from '@/lib/utils'

const formSchema = authFormSchema('sign-up')

interface CustomInput {
  control: Control<z.infer<typeof formSchema>>,
  name: FieldPath<z.infer<typeof formSchema>>,
  label: string,
  placeholder: string
}

// Auto-format date as DD-MM-YYYY (Indian format)
const formatDateInput = (value: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Format as DD-MM-YYYY
  if (digits.length <= 2) {
    return digits;
  } else if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  } else {
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
  }
};

// Convert DD-MM-YYYY to YYYY-MM-DD for API
const convertToAPIFormat = (indianDate: string): string => {
  const parts = indianDate.split('-');
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
  }
  return indianDate;
};

// Auto-format Indian phone number with +91
const formatPhoneInput = (value: string): string => {
  // Remove all non-digits
  let digits = value.replace(/\D/g, '');
  
  // Remove leading 91 if user types it (we'll add +91 prefix)
  if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }
  
  // Limit to 10 digits
  digits = digits.slice(0, 10);
  
  // Format as +91 XXXXX XXXXX
  if (digits.length === 0) {
    return '';
  } else if (digits.length <= 5) {
    return `+91 ${digits}`;
  } else {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
};

// Get raw phone number for API (just digits with country code)
const getPhoneForAPI = (formattedPhone: string): string => {
  const digits = formattedPhone.replace(/\D/g, '');
  // Ensure it starts with 91
  if (digits.startsWith('91')) {
    return digits;
  }
  return `91${digits}`;
};

const CustomInput = ({ control, name, label, placeholder }: CustomInput) => {
  const isDateField = name === 'dateOfBirth';
  const isPhoneField = name === 'phone';

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <div className="form-item">
          <FormLabel className="form-label">
            {label}
          </FormLabel>
          <div className="flex w-full flex-col">
            <FormControl>
              <Input 
                placeholder={
                  isDateField ? 'DD-MM-YYYY' : 
                  isPhoneField ? '+91 XXXXX XXXXX' : 
                  placeholder
                }
                className="input-class"
                type={name === 'password' ? 'password' : 'text'}
                maxLength={isDateField ? 10 : isPhoneField ? 16 : undefined}
                {...field}
                value={field.value || ''}
                onChange={(e) => {
                  if (isDateField) {
                    const formatted = formatDateInput(e.target.value);
                    field.onChange(formatted);
                  } else if (isPhoneField) {
                    const formatted = formatPhoneInput(e.target.value);
                    field.onChange(formatted);
                  } else {
                    field.onChange(e.target.value);
                  }
                }}
              />
            </FormControl>
            <FormMessage className="form-message mt-2" />
          </div>
        </div>
      )}
    />
  )
}

export { convertToAPIFormat };
export default CustomInput