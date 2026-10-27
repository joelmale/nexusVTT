import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';
import { recommendedFeatProficiencies } from '../services/featProficiencies';
import { FeatProficiencyChoices } from './FeatProficiencyChoices';

describe('repeatable feat proficiency controls', () => {
  it('edits one Skilled lesson without overwriting the other lesson', () => {
    const data: CharacterCreationData = {
      ...REFERENCE_BUILDS.WL24.creationData,
      level: 2,
      humanOriginFeat: 'alert',
      eldritchInvocations: ['eldritch-mind', 'lessons-of-the-first-ones'],
      featChoices: {
        'invocation:lessons-of-the-first-ones': {
          targets: ['skilled:lesson-1', 'skilled:lesson-2'],
        },
      },
    };
    data.featChoices = recommendedFeatProficiencies(data);
    data.featChoices['skilled:lesson-1'] = {
      proficiencies: [
        'Unknown training',
        ...(
          data.featChoices['skilled:lesson-1'].proficiencies as string[]
        ).slice(1),
      ],
    };
    const onChange = vi.fn();
    render(<FeatProficiencyChoices data={data} onChange={onChange} />);
    expect(screen.getAllByRole('combobox')).toHaveLength(6);
    expect(
      screen.getByRole('combobox', { name: 'Skilled lesson 1 proficiency 1' }),
    ).toHaveValue('Unknown training');
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Skilled lesson 1 proficiency 1' }),
      { target: { value: '' } },
    );
    const changed = onChange.mock.calls[0][0] as Partial<CharacterCreationData>;
    expect(changed.featChoices?.['skilled:lesson-1'].proficiencies).toEqual([
      '',
      ...(data.featChoices['skilled:lesson-1'].proficiencies as string[]).slice(
        1,
      ),
    ]);
    expect(changed.featChoices?.['skilled:lesson-2']).toEqual(
      data.featChoices['skilled:lesson-2'],
    );
  });
});
