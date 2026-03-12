import { RelativeTimePipe } from './relative-time.pipe';

describe('RelativeTimePipe', () => {
  const pipe = new RelativeTimePipe();

  it('should return "—" for null/undefined', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('should return "adesso" for less than 1 minute ago', () => {
    expect(pipe.transform(new Date())).toBe('adesso');
  });

  it('should return minutes for < 60 min', () => {
    const d = new Date(Date.now() - 5 * 60_000);
    expect(pipe.transform(d)).toBe('5m fa');
  });

  it('should return hours for < 24h', () => {
    const d = new Date(Date.now() - 3 * 3_600_000);
    expect(pipe.transform(d)).toBe('3h fa');
  });

  it('should return "ieri" for 1 day ago', () => {
    const d = new Date(Date.now() - 86_400_000);
    expect(pipe.transform(d)).toBe('ieri');
  });

  it('should return days for < 30 days', () => {
    const d = new Date(Date.now() - 10 * 86_400_000);
    expect(pipe.transform(d)).toBe('10g fa');
  });

  it('should return locale date string for >= 30 days', () => {
    const d = new Date(Date.now() - 60 * 86_400_000);
    expect(pipe.transform(d)).toBe(d.toLocaleDateString('it-IT'));
  });
});
