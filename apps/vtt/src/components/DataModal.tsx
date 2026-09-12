import React, { useState } from 'react';

interface Field {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'multiselect';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface DataModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<T>) => void;
  title: string;
  fields: Field[];
  initialData?: Partial<T>;
  mode: 'add' | 'edit';
}

export function DataModal<T extends Record<string, unknown>>({
  isOpen,
  onClose,
  onSave,
  title,
  fields,
  initialData = {},
  mode,
}: DataModalProps<T>) {
  const [formData, setFormData] = useState<Partial<T>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      if (field.required && !formData[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
    setErrors({});
    onClose();
  };

  const handleFieldChange = (
    key: string,
    value: string | number | boolean | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const renderField = (field: Field) => {
    const value = formData[field.key] || '';
    const error = errors[field.key];

    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <input
            type={field.type}
            value={String(value)}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-600'
            }`}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={String(value)}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-600'
            }`}
          />
        );

      case 'select':
        return (
          <select
            value={String(value)}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-600'
            }`}
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => handleFieldChange(field.key, e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
        );

      case 'multiselect': {
        const selectedValues = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((v) => v !== option.value);
                    handleFieldChange(field.key, newValues);
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 mr-2"
                />
                <span className="text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">
            {mode === 'add' ? 'Add' : 'Edit'} {title}
          </h2>
          <button
            onClick={() => {
              setErrors({});
              onClose();
            }}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {renderField(field)}
              {errors[field.key] && (
                <p className="text-red-500 text-sm mt-1">{errors[field.key]}</p>
              )}
            </div>
          ))}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setErrors({});
                onClose();
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              {mode === 'add' ? 'Add' : 'Save'} {title}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
