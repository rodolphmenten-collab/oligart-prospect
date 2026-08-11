import type { Intention } from '@/lib/types';

export const INTENTION_META: Record<Intention, { label: string; symbol: string }> = {
  dating: { label: 'Dating', symbol: '♥' },
  business: { label: 'Business', symbol: '◆' },
  social: { label: 'Social', symbol: '●' },
  looking: { label: 'Just looking', symbol: '○' },
};
