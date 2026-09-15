/**
 * Widget System Exports
 *
 * Central export point for all widget components.
 * Import from this file to use any widget in the character creation wizard.
 */

export { SelectionPoolWidget } from './SelectionPoolWidget';
export { BranchChoiceWidget } from './BranchChoiceWidget';
export { AutomaticWidget } from './AutomaticWidget';
export { ListSelectionWidget } from './ListSelectionWidget';

// Re-export widget types for convenience
export type {
  WidgetType,
  WidgetSource,
  WidgetEffect,
  Level1Feature,
  SelectionPoolConfig,
  BranchChoiceConfig,
  ListSelectionConfig,
  AutomaticConfig,
  BaseWidgetProps,
  SelectionPoolWidgetProps,
  BranchChoiceWidgetProps,
  ListSelectionWidgetProps,
  AutomaticWidgetProps,
  SkillOption,
  WeaponOption,
} from '../../../types/widgets';
