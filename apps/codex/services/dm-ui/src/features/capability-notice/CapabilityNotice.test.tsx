import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_IDS,
  CAPABILITY_REGISTRY,
  CapabilityNoticeProvider,
  getCapability,
  useCapabilityNotice,
} from './index';

function Trigger() {
  const { notifyCapability } = useCapabilityNotice();
  return (
    <button
      onClick={() => notifyCapability('session-plan.publish')}
      type="button"
    >
      Publish
    </button>
  );
}

describe('capability registry', () => {
  it('registers every planned capability with complete metadata', () => {
    expect(Object.keys(CAPABILITY_REGISTRY).sort()).toEqual(
      [...CAPABILITY_IDS].sort(),
    );
    for (const id of CAPABILITY_IDS) {
      const capability = getCapability(id);
      expect(capability.id).toBe(id);
      expect(capability.label).not.toBe('');
      expect(capability.status).toBe('planned');
      expect(capability.targetPhase).not.toBe('');
      expect(capability.description).not.toBe('');
    }
  });
});

describe('CapabilityNoticeProvider', () => {
  it('shows an accessible capability notice with phase and unchanged-data state', () => {
    render(
      <CapabilityNoticeProvider>
        <Trigger />
      </CapabilityNoticeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Publish session plan',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Planned: Session plan repository',
    );
    expect(screen.getByRole('status')).toHaveTextContent('No data changed.');
  });

  it('allows the notice to be dismissed accessibly', () => {
    render(
      <CapabilityNoticeProvider>
        <Trigger />
      </CapabilityNoticeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss capability notice' }),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('requires consumers to be inside the provider', () => {
    expect(() => render(<Trigger />)).toThrow(
      'useCapabilityNotice must be used within CapabilityNoticeProvider',
    );
  });
});
