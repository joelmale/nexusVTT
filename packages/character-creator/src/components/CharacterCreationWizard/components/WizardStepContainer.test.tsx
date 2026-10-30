import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WizardStepContainer } from './WizardStepContainer';

describe('WizardStepContainer', () => {
  it('scrolls to the top and focuses the heading when the step changes', () => {
    const { container, rerender } = render(
      <WizardStepContainer stepKey={1}>
        <h2>Step one</h2>
      </WizardStepContainer>,
    );
    const scroller = container.firstElementChild as HTMLElement;
    scroller.scrollTop = 240;
    rerender(
      <WizardStepContainer stepKey={2}>
        <h2>Step two</h2>
      </WizardStepContainer>,
    );
    expect(scroller.scrollTop).toBe(0);
    expect(document.activeElement?.textContent).toBe('Step two');
  });

  it('does nothing without a stepKey', () => {
    const { container } = render(
      <WizardStepContainer>
        <h2>Only</h2>
      </WizardStepContainer>,
    );
    expect(document.activeElement).toBe(document.body);
    expect(container.firstElementChild).not.toBeNull();
  });
});
