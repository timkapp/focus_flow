export type ScheduleType = 'daily' | 'weekly';

export interface Area {
    id: string;
    name: string;
    description?: string;
    order: number;
}

export interface Habit {
    id: string;
    areaId: string;
    name: string;
    description?: string;
    scheduleType: ScheduleType;
    targetCount: number; // e.g. 1 (daily) or 5 (weekly)
    activeDays?: number[]; // 0-6 (Sun-Sat), optional for daily
    startDate: string; // YYYY-MM-DD
    createdAt: string; // ISO date
    updatedAt: string; // ISO date
}

export interface HabitEntry {
    habitId: string;
    date: string; // ISO date string (YYYY-MM-DD)
    completedCount: number; // For now boolean-ish, but count supports multiple taps
    targetMet: boolean;
}

export interface Milestone {
    id: string;
    areaId: string;
    name: string;
    description: string;
    order: number;
    achievedDate?: string; // ISO date string of when it was achieved
    targetDate?: string; // ISO date string (YYYY-MM-DD or full ISO)
    predecessorId?: string; // ID of the milestone that must be completed first
}

export type ReviewType = 'weekly' | 'week6' | 'week13';

export interface Review {
    id: string;
    type: ReviewType;
    date: string; // YYYY-MM-DD
    completed: boolean;
    notes?: string;
    weekNumber: number;
    year: number;
}

export interface OperatingYear {
    startDate: string; // YYYY-MM-DD (Monday)
    yearLabel: string; // e.g., "2025" or "Year 1"
}
