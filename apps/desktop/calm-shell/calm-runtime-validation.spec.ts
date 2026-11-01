import { CalmDocument, CalmSession } from './calm-runtime.model';
import { validateCalmDocument } from './calm-runtime-validation';

const workspace = (): CalmDocument => ({
  tasks: [
    {
      id: 'task-a',
      title: 'Write a brief',
      project: 'Product launch',
      date: '2026-10-15',
      schedule: '10:30',
      estimate: 25,
      done: false,
      today: true,
    },
  ],
  projects: ['Product launch'],
  sessions: [],
  events: [],
  clock: null,
  drafts: {},
});

const session = (overrides: Partial<CalmSession> = {}): CalmSession => ({
  sessionKey: 'session-a',
  id: 'task-a',
  title: 'Write a brief',
  project: 'Product launch',
  date: '2026-10-15',
  start: '10:30',
  end: '10:30',
  startMinute: 630,
  endMinute: 630.2,
  focusedSeconds: 12,
  duration: 0.2,
  estimate: 25,
  recorded: true,
  dailyMs: { ['2026-10-15']: 12000 },
  ...overrides,
});

describe('Calm workspace validation', () => {
  it('keeps precise recorded seconds and daily totals', () => {
    const value = workspace();
    value.sessions.push(session());

    expect(validateCalmDocument(value)).toBe(value);
  });

  it('rejects impossible dates before task writes', () => {
    const value = workspace();
    value.tasks[0].date = '2026-02-30';

    expect(() => validateCalmDocument(value)).toThrowError('Invalid task');
  });

  it('rejects session totals that disagree with recorded seconds', () => {
    const value = workspace();
    value.sessions.push(session({ duration: 1 }));

    expect(() => validateCalmDocument(value)).toThrowError(
      'Session duration disagrees with focused time',
    );
  });

  it('rejects duplicate session identities and malformed day totals', () => {
    const value = workspace();
    value.sessions.push(session(), session());

    expect(() => validateCalmDocument(value)).toThrowError('Invalid session');

    const badDay = workspace();
    badDay.tasks[0].nativeDays = { ['not-a-date']: 1000 };
    expect(() => validateCalmDocument(badDay)).toThrowError('Invalid task');
  });
});

describe('Calm shared identities', () => {
  it('rejects projects missing from the shared project collection', () => {
    const value = workspace();
    value.projects = [];
    expect(() => validateCalmDocument(value)).toThrowError('Task project unavailable');
  });
  it('requires explicit deletion and prevents a delete/update contradiction', () => {
    const value = workspace();
    value.deletedTaskIds = ['task-a'];
    expect(() => validateCalmDocument(value)).toThrowError('Invalid task deletion');
    value.tasks = [];
    expect(validateCalmDocument(value)).toBe(value);
  });
  it('accepts multiple weekly weekdays but refuses an unsupported monthly combination', () => {
    const value = workspace();
    value.tasks[0].repeatRule = { cycle: 'weekly', every: 2, weekdays: [1, 4] };
    expect(validateCalmDocument(value)).toBe(value);
    value.tasks[0].repeatRule = {
      cycle: 'monthly',
      every: 1,
      weekdays: [1, 4],
      weekOfMonth: 1,
    };
    expect(() => validateCalmDocument(value)).toThrowError('Invalid repeat rule');
  });
  it('keeps capture drafts without needing an online account', () => {
    const value = workspace();
    value.drafts.$capture = {
      title: 'Draft +launch',
      project: 'Product launch',
      active: true,
      estimate: '25',
    };
    expect(validateCalmDocument(value).drafts.$capture.title).toBe('Draft +launch');
  });

  it('accepts time zones stored as JSON text and rejects a raw array', () => {
    const value = workspace();
    value.drafts.$settings = { timeZones: JSON.stringify(['Europe/Berlin', 'Asia/Tokyo']) };
    expect(validateCalmDocument(value).drafts.$settings.timeZones).toContain('Asia/Tokyo');
    const bad = workspace();
    (bad.drafts as Record<string, Record<string, unknown>>)['$settings'] = {
      timeZones: ['Europe/Berlin'],
    };
    expect(() => validateCalmDocument(bad)).toThrowError('Invalid workspace metadata');
  });

  it('accepts a merge baseline of JSON text and rejects other shapes', () => {
    const value = workspace();
    value.mergeBase = { projectCalendars: '{"A":"google|a"}', eventMeta: '{}' };
    expect(validateCalmDocument(value).mergeBase?.eventMeta).toBe('{}');
    const bad = workspace();
    (bad as unknown as { mergeBase: unknown }).mergeBase = { projectCalendars: { A: 1 } };
    expect(() => validateCalmDocument(bad)).toThrowError('Invalid workspace metadata');
  });
});
