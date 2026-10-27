import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClassGrantChoices } from '../components/ClassGrantChoices';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';

describe('higher-level invocation choices', () => {
  it('selects repeatable targets and preserves choices when a prerequisite is removed', () => {
    let latest: CharacterCreationData;
    function Harness() {
      const [data, setData] = useState<CharacterCreationData>({
        ...REFERENCE_BUILDS.F24.creationData,
        classSlug: 'warlock',
        level: 5,
        eldritchInvocations: ['pact-of-the-blade', 'thirsting-blade'],
        spellSelection: {
          selectedCantrips: ['eldritch-blast', 'chill-touch'],
          knownSpells: [],
        },
      });
      latest = data;
      return (
        <ClassGrantChoices
          data={data}
          onChange={(update) =>
            setData((current) => ({ ...current, ...update }))
          }
        />
      );
    }
    render(<Harness />);
    expect(
      screen.getByRole('group', { name: 'Eldritch Invocations (2/5)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Devouring Blade/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /^Agonizing Blast/ }));
    const targets = screen.getByRole('group', {
      name: /Agonizing Blast: choose/,
    });
    fireEvent.click(
      within(targets).getByRole('checkbox', { name: 'Eldritch Blast' }),
    );
    fireEvent.click(
      within(targets).getByRole('checkbox', { name: 'Chill Touch' }),
    );
    expect(
      screen.getByRole('group', { name: 'Eldritch Invocations (4/5)' }),
    ).toBeInTheDocument();
    expect(
      latest!.featChoices?.['invocation:agonizing-blast']?.targets,
    ).toEqual(['eldritch-blast', 'chill-touch']);
    fireEvent.click(
      within(targets).getByRole('checkbox', { name: 'Chill Touch' }),
    );
    expect(
      latest!.featChoices?.['invocation:agonizing-blast']?.targets,
    ).toEqual(['eldritch-blast']);
    fireEvent.click(
      screen.getByRole('checkbox', { name: /^Pact of the Blade/ }),
    );
    // Keep invalidated answers visible so the user can repair them, not silently lose them.
    expect(
      screen.getByRole('checkbox', { name: /^Thirsting Blade/ }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /^Thirsting Blade/ }));
    expect(
      screen.getByRole('checkbox', { name: /^Thirsting Blade/ }),
    ).toBeDisabled();
  });
  it.each(['cleric', 'druid'])(
    'edits the %s order through its labeled control',
    (classSlug) => {
      let latest: CharacterCreationData;
      function Harness() {
        const [data, setData] = useState({
          ...REFERENCE_BUILDS.F24.creationData,
          classSlug,
        });
        latest = data;
        return (
          <ClassGrantChoices
            data={data}
            onChange={(update) =>
              setData((current) => ({ ...current, ...update }))
            }
          />
        );
      }
      render(<Harness />);
      const cleric = classSlug === 'cleric';
      fireEvent.change(
        screen.getByRole('combobox', {
          name: cleric ? 'Divine Order' : 'Primal Order',
        }),
        { target: { value: cleric ? 'thaumaturge' : 'magician' } },
      );
      expect(cleric ? latest!.divineOrder : latest!.primalOrder).toBe(
        cleric ? 'thaumaturge' : 'magician',
      );
    },
  );
  it('edits level-four masteries and preserves normalized selections', () => {
    let latest: CharacterCreationData;
    function Harness() {
      const [data, setData] = useState({
        ...REFERENCE_BUILDS.F24.creationData,
        level: 4,
        weaponMastery: ['dagger'],
      });
      latest = data;
      return (
        <ClassGrantChoices
          data={data}
          onChange={(update) =>
            setData((current) => ({ ...current, ...update }))
          }
        />
      );
    }
    render(<Harness />);
    expect(
      screen.getByRole('group', { name: 'Weapon masteries (4 at level 4)' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dagger' }));
    expect(latest!.weaponMastery).toEqual([]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Greatsword' }));
    expect(latest!.weaponMastery).toEqual(['Greatsword']);
  });
  it('lets Lessons choose an Origin feat and hides controls for other editions/classes', () => {
    let latest: CharacterCreationData;
    function Harness() {
      const [data, setData] = useState({
        ...REFERENCE_BUILDS.WL24.creationData,
        level: 2,
        eldritchInvocations: ['lessons-of-the-first-ones'],
      });
      latest = data;
      return (
        <ClassGrantChoices
          data={data}
          onChange={(update) =>
            setData((current) => ({ ...current, ...update }))
          }
        />
      );
    }
    const { unmount } = render(<Harness />);
    const group = screen.getByRole('group', {
      name: /Lessons of the First Ones: choose/,
    });
    fireEvent.click(
      within(group).getByRole('checkbox', { name: 'Skilled (lesson grant 1)' }),
    );
    fireEvent.click(
      within(group).getByRole('checkbox', { name: 'Skilled (lesson grant 2)' }),
    );
    expect(
      latest!.featChoices?.['invocation:lessons-of-the-first-ones']?.targets,
    ).toEqual(['skilled:lesson-1', 'skilled:lesson-2']);
    unmount();
    const legacy = render(
      <ClassGrantChoices
        data={REFERENCE_BUILDS.WL14.creationData}
        onChange={() => undefined}
      />,
    );
    expect(legacy.container).toBeEmptyDOMElement();
    legacy.unmount();
    const wizard = render(
      <ClassGrantChoices
        data={REFERENCE_BUILDS.W24.creationData}
        onChange={() => undefined}
      />,
    );
    expect(wizard.container).toBeEmptyDOMElement();
  });
});
