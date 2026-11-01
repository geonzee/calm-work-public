import { calmRepeatConfig, calmRepeatFromNative } from './calm-repeat';
import { CalmTask } from './calm-runtime.model';
const task = (repeat: string): CalmTask => ({
  id: 'a',
  title: 'Review',
  project: 'Work',
  date: '2026-10-15',
  schedule: '14:00',
  estimate: 25,
  done: false,
  today: true,
  repeat,
});
describe('Calm native repeat mapping', () => {
  it('anchors weekly recurrence to the scheduled Thursday, not a fixed Monday', () => {
    const config = calmRepeatConfig(task('Every week'), '2026-10-15');
    expect(config?.thursday).toBeTrue();
    expect(config?.monday).toBeFalse();
    expect(config?.defaultEstimate).toBe(1500000);
  });
  it('distinguishes every day from weekdays', () => {
    expect(calmRepeatConfig(task('Every day'), '2026-10-15')?.sunday).toBeTrue();
    expect(calmRepeatConfig(task('Every weekday'), '2026-10-15')?.sunday).toBeFalse();
  });
  it('maps chosen weekdays and intervals into the upstream engine', () => {
    const value = task('Custom weekly');
    value.repeatRule = { cycle: 'weekly', every: 2, weekdays: [1, 4] };
    const config = calmRepeatConfig(value, '2026-10-15');
    expect(config?.repeatEvery).toBe(2);
    expect(config?.monday).toBeTrue();
    expect(config?.thursday).toBeTrue();
    expect(config?.friday).toBeFalse();
    expect(calmRepeatFromNative({ ...config!, id: 'cfg' }).repeatRule).toEqual(
      value.repeatRule,
    );
  });
  it('uses the native monthly nth-weekday anchor', () => {
    const value = task('Monthly weekday');
    value.repeatRule = { cycle: 'monthly', every: 1, weekdays: [4], weekOfMonth: 1 };
    const config = calmRepeatConfig(value, '2026-10-15');
    expect(config?.repeatCycle).toBe('MONTHLY');
    expect(config?.monthlyWeekOfMonth).toBe(1);
    expect(config?.monthlyWeekday).toBe(4);
    expect(calmRepeatFromNative({ ...config!, id: 'cfg' }).repeatRule).toEqual(
      value.repeatRule,
    );
  });
});
