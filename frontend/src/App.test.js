import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the employee login when there is no active session', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Employee Login' })).toBeInTheDocument();
});
