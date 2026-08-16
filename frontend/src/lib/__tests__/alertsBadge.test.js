import { describe, it, expect, vi } from 'vitest';
import { notifyAlertsChanged, subscribeToAlertsChanged } from '../alertsBadge';

describe('alertsBadge', () => {
  it('calls every subscribed listener when notified', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const unsubscribeA = subscribeToAlertsChanged(listenerA);
    const unsubscribeB = subscribeToAlertsChanged(listenerB);

    notifyAlertsChanged();

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubscribeA();
    unsubscribeB();
  });

  it('stops calling a listener after it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAlertsChanged(listener);

    notifyAlertsChanged();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    notifyAlertsChanged();
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });

  it('does not throw when notified with no subscribers', () => {
    expect(() => notifyAlertsChanged()).not.toThrow();
  });
});
