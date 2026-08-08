import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react's auto-cleanup relies on detecting a global
// afterEach; since tests import afterEach explicitly (no `globals: true`),
// register it manually so DOM from one test doesn't leak into the next.
afterEach(() => {
  cleanup();
});
