import { describe, it, expect, beforeEach } from 'vitest';
import { SidePanel } from './sidePanel';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('SidePanel inventory', () => {
  it('adds, stacks, checks and removes items', () => {
    const sp = new SidePanel();
    expect(sp.hasItem('shrimp')).toBe(false);

    sp.addItem('shrimp', 2);
    expect(sp.hasItem('shrimp')).toBe(true);

    sp.removeItem('shrimp', 1);
    expect(sp.hasItem('shrimp')).toBe(true); // one left

    sp.removeItem('shrimp', 5); // can't go negative
    expect(sp.hasItem('shrimp')).toBe(false);
  });

  it('cooks every raw fish into its cooked counterpart', () => {
    const sp = new SidePanel();
    sp.addItem('trout', 3);
    sp.addItem('shrimp', 1);

    const cooked = sp.cookRawFish();

    expect(cooked.length).toBe(2);
    expect(sp.hasItem('trout')).toBe(false);
    expect(sp.hasItem('shrimp')).toBe(false);
    expect(sp.hasItem('cookedTrout')).toBe(true);
    expect(sp.hasItem('cookedShrimp')).toBe(true);
  });

  it('defaults to a fresh profile when nothing is saved', () => {
    const sp = new SidePanel();
    const profile = sp.getProfile();
    expect(profile.name).toBe('Adventurer');
    expect(profile.equipment).toEqual({
      hat: 'none',
      cape: 'none',
      body: 'none',
      legs: 'none',
      weapon: 'none',
    });
  });

  it('restores a saved profile on construction', () => {
    localStorage.setItem(
      'village-profile',
      JSON.stringify({ name: 'Bradley', shirt: 0xe58b3c, equipment: { cape: 'red' } })
    );
    const sp = new SidePanel();
    const profile = sp.getProfile();
    expect(profile.name).toBe('Bradley');
    expect(profile.shirt).toBe(0xe58b3c);
    expect(profile.equipment?.cape).toBe('red');
  });
});
