import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const required = { DATABASE_URL: 'postgres://localhost:5432/test' };

  it('applies defaults when optional vars are missing', () => {
    const env = validateEnv({ ...required });

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('converts PORT from string to number', () => {
    const env = validateEnv({ ...required, PORT: '8080' });

    expect(env.PORT).toBe(8080);
  });

  it('rejects a PORT that is not a number', () => {
    expect(() => validateEnv({ ...required, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...required, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('requires DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });
});
