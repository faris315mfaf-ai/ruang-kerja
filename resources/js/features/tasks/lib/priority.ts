import type { Priority } from '../types';

/** Urgent first, "Tanpa" last (mirrors TaskPriority::sortWeight()). */
export function prioritySortWeight(priority: Priority): number {
    return priority === 0 ? 5 : priority;
}
