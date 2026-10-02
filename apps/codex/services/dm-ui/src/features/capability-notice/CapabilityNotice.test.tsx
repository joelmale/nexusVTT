import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_IDS,
  CAPABILITY_REGISTRY,
  CapabilityNoticeProvider,
  getCapability,
  useCapabilityNotice,
} from './index';

function PlannedTrigger() {
  const { notifyCapability } = useCapabilityNotice();
  return (
    <button
      onClick={() => notifyCapability('campaign.search.overview')}
      type="button"
    >
      Search
    </button>
  );
}

function ImplementedTrigger() {
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
  it('registers every capability with complete metadata and valid status', () => {
    expect(Object.keys(CAPABILITY_REGISTRY).sort()).toEqual(
      [...CAPABILITY_IDS].sort(),
    );
    for (const id of CAPABILITY_IDS) {
      const capability = getCapability(id);
      expect(capability.id).toBe(id);
      expect(capability.label).not.toBe('');
      if (
        id === 'session-plan.publish' ||
        id === 'session-plan.activate' ||
        id === 'campaign.section.open' ||
        id === 'campaign.search' ||
        id === 'encounter.deploy' ||
        id === 'map.pin.create' ||
        id === 'map.object.link' ||
        id === 'map.scene.create'
      ) {
        expect(capability.status).toBe('implemented');
      } else if (id === 'encounter.deploy.demo') {
        expect(capability.status).toBe('local-demo');
      } else {
        expect(capability.status).toBe('planned');
      }
      expect(capability.targetPhase).not.toBe('');
      expect(capability.description).not.toBe('');
    }
  });
});

describe('CapabilityNoticeProvider', () => {
  it('shows an accessible capability notice with phase and unchanged-data state for planned capabilities', () => {
    render(
      <CapabilityNoticeProvider>
        <PlannedTrigger />
      </CapabilityNoticeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('status')).toHaveTextContent('Campaign search');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Planned: Overview search',
    );
    expect(screen.getByRole('status')).toHaveTextContent('No data changed.');
  });

  it('shows implemented status for implemented capabilities', () => {
    render(
      <CapabilityNoticeProvider>
        <ImplementedTrigger />
      </CapabilityNoticeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Publish session plan',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Implemented: Session plan repository',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Active in Campaign Studio.',
    );
  });

  it('allows the notice to be dismissed accessibly', () => {
    render(
      <CapabilityNoticeProvider>
        <ImplementedTrigger />
      </CapabilityNoticeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss capability notice' }),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('requires consumers to be inside the provider', () => {
    expect(() => render(<ImplementedTrigger />)).toThrow(
      'useCapabilityNotice must be used within CapabilityNoticeProvider',
    );
  });
});
