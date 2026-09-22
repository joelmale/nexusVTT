# D&D 5e Formulas & Progression Reference

This reference provides mathematical rules, level progressions, and spell slot matrices for 5th Edition SRD implementations.

---

## 1. Challenge Rating (CR) to Experience Points (XP)

| CR | XP | Proficiency Bonus | CR | XP | Proficiency Bonus |
|:---|:---|:------------------|:---|:---|:------------------|
| 0 | 10 | +2 | 11 | 7,200 | +4 |
| 1/8 | 25 | +2 | 12 | 8,400 | +4 |
| 1/4 | 50 | +2 | 13 | 10,000 | +5 |
| 1/2 | 100 | +2 | 14 | 11,500 | +5 |
| 1 | 200 | +2 | 15 | 13,000 | +5 |
| 2 | 450 | +2 | 16 | 15,000 | +5 |
| 3 | 700 | +2 | 17 | 18,000 | +6 |
| 4 | 1,100 | +2 | 18 | 20,000 | +6 |
| 5 | 1,800 | +3 | 19 | 22,000 | +6 |
| 6 | 2,300 | +3 | 20 | 25,000 | +6 |
| 7 | 2,900 | +3 | 21 | 33,000 | +7 |
| 8 | 3,900 | +3 | 22 | 41,000 | +7 |
| 9 | 5,000 | +4 | 23 | 50,000 | +7 |
| 10 | 5,900 | +4 | 24 | 62,000 | +7 |
| | | | 30 | 155,000 | +9 |

---

## 2. Character Level XP Thresholds

```typescript
export const CHARACTER_XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};
```

---

## 3. Full-Caster Spell Slot Matrix

Levels 1st through 9th slots per character/caster level:

```typescript
// Index 0 is unused; indices 1-20 represent caster levels
export const FULL_CASTER_SLOTS: number[][] = [
  [],
  // 1st 2nd 3rd 4th 5th 6th 7th 8th 9th
  [2, 0, 0, 0, 0, 0, 0, 0, 0], // Lvl 1
  [3, 0, 0, 0, 0, 0, 0, 0, 0], // Lvl 2
  [4, 2, 0, 0, 0, 0, 0, 0, 0], // Lvl 3
  [4, 3, 0, 0, 0, 0, 0, 0, 0], // Lvl 4
  [4, 3, 2, 0, 0, 0, 0, 0, 0], // Lvl 5
  [4, 3, 3, 0, 0, 0, 0, 0, 0], // Lvl 6
  [4, 3, 3, 1, 0, 0, 0, 0, 0], // Lvl 7
  [4, 3, 3, 2, 0, 0, 0, 0, 0], // Lvl 8
  [4, 3, 3, 3, 1, 0, 0, 0, 0], // Lvl 9
  [4, 3, 3, 3, 2, 0, 0, 0, 0], // Lvl 10
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // Lvl 11
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // Lvl 12
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // Lvl 13
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // Lvl 14
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // Lvl 15
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // Lvl 16
  [4, 3, 3, 3, 2, 1, 1, 1, 1], // Lvl 17
  [4, 3, 3, 3, 3, 1, 1, 1, 1], // Lvl 18
  [4, 3, 3, 3, 3, 2, 1, 1, 1], // Lvl 19
  [4, 3, 3, 3, 3, 2, 2, 1, 1], // Lvl 20
];
```

---

## 4. Multiclass Spellcaster Calculation

To determine spell slots for a multiclass character:
1. Add all levels in full casters (Wizard, Cleric, Druid, Sorcerer, Bard).
2. Add $\lfloor \frac{\text{Paladin Level}}{2} \rfloor + \lfloor \frac{\text{Ranger Level}}{2} \rfloor$.
3. Add $\lfloor \frac{\text{Artificer Level}}{2} \rceil$ (Artificer rounds up).
4. Add $\lfloor \frac{\text{Fighter (Eldritch Knight) Level}}{3} \rfloor + \lfloor \frac{\text{Rogue (Arcane Trickster) Level}}{3} \rfloor$.
5. Use the resulting total level to index into `FULL_CASTER_SLOTS`.
*(Note: Warlock Pact Magic slots are tracked separately and do not combine into the shared spell slot pool).*
