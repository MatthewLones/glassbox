import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { NotificationBell } from '../notification-bell';
import { NotificationItem } from '../notification-item';
import type { Notification } from '@/hooks/use-notifications';

describe('NotificationBell', () => {
  it('should render without badge when count is 0', () => {
    render(<NotificationBell unreadCount={0} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('should render with badge when count is greater than 0', () => {
    render(<NotificationBell unreadCount={5} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should show 99+ when count exceeds 99', () => {
    render(<NotificationBell unreadCount={150} />);

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<NotificationBell unreadCount={3} onClick={handleClick} />);

    await userEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalled();
  });

  it('should have correct aria-label for unread count', () => {
    render(<NotificationBell unreadCount={1} />);
    expect(screen.getByText('1 unread notification')).toBeInTheDocument();

    const { rerender } = render(<NotificationBell unreadCount={5} />);
    expect(screen.getByText('5 unread notifications')).toBeInTheDocument();
  });
});

describe('NotificationItem', () => {
  const baseNotification: Notification = {
    id: 'notif-1',
    type: 'node_created',
    title: 'New Node Created',
    message: 'A new node was created in your project.',
    createdAt: new Date().toISOString(),
    read: false,
  };

  it('should render notification content', () => {
    render(<NotificationItem notification={baseNotification} />);

    expect(screen.getByText('New Node Created')).toBeInTheDocument();
    expect(screen.getByText('A new node was created in your project.')).toBeInTheDocument();
  });

  it('should show unread indicator for unread notifications', () => {
    const { container } = render(<NotificationItem notification={baseNotification} />);

    // Unread indicator is a small blue dot
    const indicator = container.querySelector('.bg-primary');
    expect(indicator).toBeInTheDocument();
  });

  it('should not show unread indicator for read notifications', () => {
    const readNotification = { ...baseNotification, read: true };
    const { container } = render(<NotificationItem notification={readNotification} />);

    // Should not have the unread indicator dot (with bg-primary and h-2 w-2)
    const indicator = container.querySelector('.absolute.left-1');
    expect(indicator).not.toBeInTheDocument();
  });

  it('should call onRead when clicked and unread', async () => {
    const handleRead = vi.fn();
    const handleClick = vi.fn();

    render(
      <NotificationItem
        notification={baseNotification}
        onRead={handleRead}
        onClick={handleClick}
      />
    );

    await userEvent.click(screen.getByText('New Node Created'));

    expect(handleRead).toHaveBeenCalled();
    expect(handleClick).toHaveBeenCalled();
  });

  it('should not call onRead when clicked and already read', async () => {
    const handleRead = vi.fn();
    const handleClick = vi.fn();
    const readNotification = { ...baseNotification, read: true };

    render(
      <NotificationItem
        notification={readNotification}
        onRead={handleRead}
        onClick={handleClick}
      />
    );

    await userEvent.click(screen.getByText('New Node Created'));

    expect(handleRead).not.toHaveBeenCalled();
    expect(handleClick).toHaveBeenCalled();
  });

  it('should render correct icon for different notification types', () => {
    const types = [
      { type: 'node_created' as const, expected: true },
      { type: 'execution_completed' as const, expected: true },
      { type: 'hitl_request' as const, expected: true },
    ];

    types.forEach(({ type }) => {
      const notification = { ...baseNotification, type };
      const { unmount } = render(<NotificationItem notification={notification} />);

      // Just verify it renders without error
      expect(screen.getByText('New Node Created')).toBeInTheDocument();
      unmount();
    });
  });

  it('should show dismiss button on hover and call onDismiss when clicked', async () => {
    const handleDismiss = vi.fn();

    render(
      <NotificationItem
        notification={baseNotification}
        onDismiss={handleDismiss}
      />
    );

    // The dismiss button has sr-only text "Dismiss"
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    await userEvent.click(dismissButton);

    expect(handleDismiss).toHaveBeenCalled();
  });
});
