import { differenceInCalendarDays, addWeeks, startOfDay, parseISO, format, isMonday, nextMonday, previousMonday } from 'date-fns';

export interface YearStatus {
    currentWeek: number; // 1-52
    currentSeason: number; // 1-4
    isOffSystem: boolean; // True if day 365+ or before start
    daysRemainingInWeek: number;
}

export const WEEKS_IN_KEY_YEAR = 52;
export const WEEKS_IN_SEASON = 13;

/**
 * Validates if the start date matches the expected day of the week (0=Sunday, 1=Monday, etc.)
 */
export const isValidStartDate = (date: Date, targetDayOfWeek: number = 1): boolean => {
    return date.getDay() === targetDayOfWeek;
};

export const getSeasonForWeek = (week: number): number => {
    if (week < 1 || week > 52) return 0;
    return Math.ceil(week / WEEKS_IN_SEASON);
};

/**
 * Calculates the current status of the operating year given a start date.
 */
export const getYearStatus = (startDateStr: string, targetDateStr?: string): YearStatus => {
    const startDate = startOfDay(parseISO(startDateStr));
    const targetDate = targetDateStr ? startOfDay(parseISO(targetDateStr)) : startOfDay(new Date());

    const daysDiff = differenceInCalendarDays(targetDate, startDate);

    if (daysDiff < 0) {
        return { currentWeek: 0, currentSeason: 0, isOffSystem: true, daysRemainingInWeek: 0 };
    }

    // day 0-6 is week 1. day 7-13 is week 2.
    const weekIndex = Math.floor(daysDiff / 7); // 0-based
    const currentWeek = weekIndex + 1;

    if (currentWeek > 52) {
        return { currentWeek, currentSeason: 0, isOffSystem: true, daysRemainingInWeek: 0 };
    }

    // Calculate days remaining in week (assuming week ends on Sunday)
    // Current day index in week (0=Mon, 6=Sun) -> start date is Monday (0)
    const dayOfWeekIndex = daysDiff % 7;
    const daysRemainingInWeek = 6 - dayOfWeekIndex;

    return {
        currentWeek,
        currentSeason: getSeasonForWeek(currentWeek),
        isOffSystem: false,
        daysRemainingInWeek
    };
};

/**
 * Returns the date range for a specific week number.
 */
export const getWeekRange = (startDateStr: string, weekNumber: number) => {
    const startDate = startOfDay(parseISO(startDateStr));
    const weekStart = addWeeks(startDate, weekNumber - 1);
    const weekEnd = addWeeks(weekStart, 1); // Not inclusive of the exact end time, but good for range
    // Actually, let's return start and end dates inclusive
    const weekEndInclusive = new Date(weekEnd);
    weekEndInclusive.setDate(weekEndInclusive.getDate() - 1);

    return {
        start: weekStart,
        end: weekEndInclusive
    };
};

export const formatDateForUrl = (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
};
