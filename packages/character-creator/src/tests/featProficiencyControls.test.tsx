import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeatProficiencyChoices } from '../components/FeatProficiencyChoices';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';
import { featProficiencyErrors } from '../services/featProficiencies';

describe('feat proficiency controls', () => {
  it('retains three independently selected proficiencies and clears the required-choice error', () => {
    function Host() {
      const [data, setData] = useState({
        ...REFERENCE_BUILDS.F24.creationData,
        humanOriginFeat: 'skilled',
      });
      return (
        <>
          <FeatProficiencyChoices
            data={data}
            onChange={(patch) =>
              setData((current) => ({ ...current, ...patch }))
            }
          />
          <p role="status">
            {featProficiencyErrors(data).join(' ') || 'Complete'}
          </p>
        </>
      );
    }
    render(<Host />);
    for (const [index, name] of ['Arcana', 'History', 'Lute'].entries())
      fireEvent.change(
        screen.getByLabelText(`Skilled proficiency ${index + 1}`),
        { target: { value: name } },
      );
    expect(screen.getByRole('status')).toHaveTextContent('Complete');
    expect(screen.getByLabelText('Skilled proficiency 1')).toHaveValue(
      'Arcana',
    );
    expect(screen.getByLabelText('Skilled proficiency 3')).toHaveValue('Lute');
  });
});
