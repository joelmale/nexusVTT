import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SmartNavigationButton } from './SmartNavigationButton';
import { useRevealValidation } from '../../../hooks/useRevealValidation';

function Probe() {
  const { revealed } = useRevealValidation();
  return revealed ? <p>Please select a skill</p> : null;
}

describe('SmartNavigationButton', () => {
  it('announces missing items as plain sentences', () => {
    render(
      <SmartNavigationButton
        canProceed={false}
        missingItems={['⚠️ Please select a subclass']}
        onClick={() => undefined}
      >
        Next
      </SmartNavigationButton>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Please select a subclass');
    expect(status.textContent).not.toContain('⚠');
  });

  it('reveals held validation messages when Next is pressed while blocked', () => {
    const onClick = vi.fn();
    render(
      <>
        <Probe />
        <SmartNavigationButton
          canProceed={false}
          missingItems={['Pick a skill']}
          onClick={onClick}
        >
          Next
        </SmartNavigationButton>
      </>,
    );
    expect(screen.queryByText('Please select a skill')).toBeNull();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    });
    expect(screen.getByText('Please select a skill')).toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
  });
});
