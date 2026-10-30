import { describe, expect, it } from 'vitest';
import { humanizeId } from './displayLabels';

describe('humanizeId', () => {
  it.each([
    ['magic-initiate', 'Magic Initiate'],
    ['pact-of-the-blade', 'Pact of the Blade'],
    ['AnimalHandling', 'Animal Handling'],
    ['SleightOfHand', 'Sleight of Hand'],
    ['Gaming-Set-(Matching-Choice)', 'Gaming Set (Matching Choice)'],
    ['Arrows-(20)', 'Arrows (20)'],
    ["Traveler's-Clothes", "Traveler's Clothes"],
    ['rock-gnome', 'Rock Gnome'],
    ['of-the-wild', 'Of the Wild'],
    ['', ''],
  ])('%s -> %s', (input, expected) => {
    expect(humanizeId(input)).toBe(expected);
  });
});
