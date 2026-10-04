import { describe, it, expect, beforeEach } from 'vitest';
import { loadProfile, saveProfile } from './profile';

beforeEach(() => localStorage.clear());

describe('profile persistence', () => {
  it('returns an empty object when nothing is stored', () => {
    expect(loadProfile()).toEqual({});
  });

  it('saves and loads a profile', () => {
    saveProfile({ name: 'Bradley', shirt: 0x123456 });
    expect(loadProfile()).toEqual({ name: 'Bradley', shirt: 0x123456 });
  });

  it('merges equipment per slot instead of overwriting the whole map', () => {
    saveProfile({ equipment: { cape: 'red' } });
    saveProfile({ equipment: { hat: 'ironHelm' } });
    expect(loadProfile().equipment).toEqual({ cape: 'red', hat: 'ironHelm' });
  });

  it('later writes override earlier values for the same key', () => {
    saveProfile({ name: 'One' });
    saveProfile({ name: 'Two' });
    expect(loadProfile().name).toBe('Two');
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem('village-profile', '{ not valid json');
    expect(loadProfile()).toEqual({});
  });
});
