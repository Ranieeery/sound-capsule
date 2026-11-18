import { beforeEach, describe, expect, it } from 'vitest';
import {
  getStudioSession,
  patchStudioSession,
  resetStudioSession,
  setStudioSession,
  subscribeToStudioSession,
} from '@/lib/studioSession';

beforeEach(() => {
  resetStudioSession();
});

describe('studio session store', () => {
  it('starts empty and defaults to the Ember theme', () => {
    expect(getStudioSession()).toMatchObject({
      username: '',
      periodKind: 'month',
      result: null,
      themeId: 'ember',
      showUsername: true,
      uploadedPhoto: null,
    });
  });

  it('patches and preserves non-localized session data', () => {
    patchStudioSession({
      username: 'ranieri',
      periodKind: 'custom',
      customStart: '2026-08-18',
      customEnd: '2026-11-18',
      showUsername: false,
      uploadedPhoto: 'data:image/jpeg;base64,abc',
    });

    expect(getStudioSession()).toMatchObject({
      username: 'ranieri',
      periodKind: 'custom',
      customStart: '2026-08-18',
      customEnd: '2026-11-18',
      showUsername: false,
      uploadedPhoto: 'data:image/jpeg;base64,abc',
    });
  });

  it('notifies subscribers and can be reset', () => {
    let notifications = 0;
    const unsubscribe = subscribeToStudioSession(() => {
      notifications += 1;
    });

    setStudioSession({ ...getStudioSession(), username: 'someone' });
    expect(notifications).toBe(1);
    expect(getStudioSession().username).toBe('someone');

    resetStudioSession();
    expect(notifications).toBe(2);
    expect(getStudioSession().username).toBe('');

    unsubscribe();
    setStudioSession({ ...getStudioSession(), username: 'ignored' });
    expect(notifications).toBe(2);
  });
});
