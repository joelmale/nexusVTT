import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { LegacyInvocationChoices } from './LegacyInvocationChoices';

describe('legacy invocation choice repairs', () => {
  it('shows the current entitlement and permits removal of selections whose prerequisites changed', () => {
    const onChange = vi.fn();
    render(
      <LegacyInvocationChoices
        data={{
          ...REFERENCE_BUILDS.WL14.creationData,
          level: 5,
          pactBoon: 'tome',
          eldritchInvocations: ['thirsting-blade', 'armor-of-shadows'],
        }}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole('group', { name: 'Legacy Eldritch Invocations (2/3)' }),
    ).toBeInTheDocument();
    const stale = screen.getByRole('checkbox', { name: /Thirsting Blade/ });
    expect(stale).toBeChecked();
    expect(stale).toBeEnabled();
    fireEvent.click(stale);
    expect(onChange).toHaveBeenCalledWith({
      eldritchInvocations: ['armor-of-shadows'],
    });
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Legacy Pact Boon' }),
      { target: { value: 'blade' } },
    );
    expect(onChange).toHaveBeenLastCalledWith({ pactBoon: 'blade' });
  });
  it('allows unknown imported IDs and premature Pact choices to be cleared', () => {
    const onChange = vi.fn();
    render(
      <LegacyInvocationChoices
        data={{
          ...REFERENCE_BUILDS.WL14.creationData,
          level: 2,
          pactBoon: 'blade',
          eldritchInvocations: ['eldritch-invocation-mystery'],
        }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /mystery/ }));
    expect(onChange).toHaveBeenCalledWith({ eldritchInvocations: [] });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ pactBoon: undefined });
  });
  it('shows no invocation controls at legacy level one or in the revised edition', () => {
    const { rerender } = render(
      <LegacyInvocationChoices
        data={REFERENCE_BUILDS.WL14.creationData}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    rerender(
      <LegacyInvocationChoices
        data={REFERENCE_BUILDS.WL24.creationData}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});
