import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App';

test('renders_application_name', () => {
  render(<App />);

  expect(
    screen.getByRole('heading', { name: 'Japanese Reader', level: 1 }),
  ).toBeInTheDocument();
});
