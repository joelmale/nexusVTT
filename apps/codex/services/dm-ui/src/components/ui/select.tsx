import * as React from 'react';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

// Compatibility components for shadcn/ui pattern
// These allow the code to use Select with SelectTrigger, SelectContent, etc.
// but we're implementing them as simple HTML select wrappers for now

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextValue>({});

interface SelectRootProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

function SelectRoot({ value, onValueChange, children }: SelectRootProps) {
  return (
    <SelectContext.Provider value={{ value, onValueChange }}>
      {children}
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends React.HTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode;
}

const SelectTrigger = React.forwardRef<HTMLSelectElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { value, onValueChange } = React.useContext(SelectContext);
    const resolvedValue = value ?? '__placeholder__';
    return (
      <select
        ref={ref}
        value={resolvedValue}
        onChange={(e) => onValueChange?.(e.target.value)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

interface SelectContentProps {
  children: React.ReactNode;
}

function SelectContent({ children }: SelectContentProps) {
  // In a simple select, content is just passed through
  return <>{children}</>;
}

interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  value: string;
  children: React.ReactNode;
}

const SelectItem = React.forwardRef<HTMLOptionElement, SelectItemProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <option ref={ref} className={className} {...props}>
        {children}
      </option>
    );
  }
);
SelectItem.displayName = 'SelectItem';

interface SelectValueProps {
  placeholder?: string;
}

function SelectValue({ placeholder }: SelectValueProps) {
  // This is handled by the select's placeholder attribute in HTML
  return (
    <option value="__placeholder__" disabled hidden>
      {placeholder}
    </option>
  );
}

export {
  Select,
  SelectRoot as SelectWrapper,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
};

// Re-export SelectRoot as default Select for the new pattern
export default SelectRoot;
