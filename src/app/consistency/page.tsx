'use client';

import * as React from 'react';
import { Box, Typography, Paper, FormControl, Select, MenuItem, SelectChangeEvent, useTheme, useMediaQuery, Tooltip } from '@mui/material';
import MainLayout from '../../components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useYear } from '@/contexts/YearContext';
import { collections } from '@/lib/firebase/converters';
import { onSnapshot, query, where } from 'firebase/firestore';
import { Habit, HabitEntry } from '@/types';
import { addDays, addWeeks, format, startOfDay, isSameDay, subWeeks, subYears, parseISO } from 'date-fns';

type TimeRange = 'current_year' | 'prior_year' | 'current_season' | 'prior_season';

export default function ConsistencyPage() {
    const { user } = useAuth();
    const { startDate: yearStartDate } = useYear();
    const [habits, setHabits] = React.useState<Habit[]>([]);
    const [entries, setEntries] = React.useState<HabitEntry[]>([]);
    const [range, setRange] = React.useState<TimeRange>('current_year');

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const today = startOfDay(new Date());

    React.useEffect(() => {
        if (!user) return;
        const q = query(collections.habits(user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHabits(snapshot.docs.map(doc => doc.data()));
        });
        return () => unsubscribe();
    }, [user]);

    const getDateRange = React.useCallback(() => {
        if (!yearStartDate) return { start: new Date(), end: new Date() };
        const start = parseISO(yearStartDate);

        switch (range) {
            case 'current_year':
                return { start, end: addDays(addWeeks(start, 52), -1) };
            case 'prior_year':
                const priorStart = subYears(start, 1);
                return { start: priorStart, end: addDays(start, -1) };
            case 'current_season':
                const today = startOfDay(new Date());
                const diffTime = Math.abs(today.getTime() - start.getTime());
                const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
                const currentSeasonIndex = Math.floor((diffWeeks - 1) / 13);
                const seasonStart = addWeeks(start, currentSeasonIndex * 13);
                return { start: seasonStart, end: addDays(addWeeks(seasonStart, 13), -1) };
            case 'prior_season':
                const today2 = startOfDay(new Date());
                const diffTime2 = Math.abs(today2.getTime() - start.getTime());
                const diffWeeks2 = Math.ceil(diffTime2 / (1000 * 60 * 60 * 24 * 7));
                const currentSeasonIndex2 = Math.floor((diffWeeks2 - 1) / 13);
                const priorSeasonIndex = currentSeasonIndex2 - 1;
                const priorSeasonStart = addWeeks(start, priorSeasonIndex * 13);
                return { start: priorSeasonStart, end: addDays(addWeeks(priorSeasonStart, 13), -1) };
            default:
                return { start, end: addDays(addWeeks(start, 52), -1) };
        }
    }, [range, yearStartDate]);

    const { start: rangeStart, end: rangeEnd } = getDateRange();

    const fetchStart = React.useMemo(() => {
        if (!yearStartDate) return rangeStart;
        const ys = parseISO(yearStartDate);
        const last7 = addDays(today, -6);
        return new Date(Math.min(rangeStart.getTime(), ys.getTime(), last7.getTime()));
    }, [rangeStart, yearStartDate, today]);

    const fetchEnd = React.useMemo(() => {
        return new Date(Math.max(rangeEnd.getTime(), today.getTime()));
    }, [rangeEnd, today]);

    React.useEffect(() => {
        if (!user || !fetchStart || !fetchEnd) return;
        const startStr = format(fetchStart, 'yyyy-MM-dd');
        const endStr = format(fetchEnd, 'yyyy-MM-dd');
        const q = query(collections.entries(user.uid), where('date', '>=', startStr), where('date', '<=', endStr));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEntries(snapshot.docs.map(doc => doc.data()));
        });
        return () => unsubscribe();
    }, [user, fetchStart, fetchEnd]);

    const calculateConsistency = (start: Date, end: Date) => {
        let successful = 0;
        let possible = 0;
        const current = new Date(start);

        while (current <= end) {
            if (current > today) break;

            const dateStr = format(current, 'yyyy-MM-dd');
            const dayOfWeek = current.getDay();
            const daysEntries = entries.filter(e => e.date === dateStr);

            const activeHabits = habits.filter(h =>
                (h.scheduleType === 'daily' || (h.scheduleType === 'weekly' && h.activeDays && h.activeDays.length > 0)) &&
                (h.startDate ? dateStr >= h.startDate : startOfDay(parseISO(h.createdAt)) <= current) &&
                (!h.activeDays || h.activeDays.length === 0 || h.activeDays.includes(dayOfWeek))
            );

            if (activeHabits.length > 0) {
                possible += activeHabits.length;
                activeHabits.forEach(h => {
                    const entry = daysEntries.find(e => e.habitId === h.id);
                    if (entry) {
                        const progress = Math.min(entry.completedCount, h.targetCount) / h.targetCount;
                        successful += progress;
                    }
                });
            }

            current.setDate(current.getDate() + 1);
        }

        return possible === 0 ? 0 : Math.round((successful / possible) * 100);
    };

    const todayStats = React.useMemo(() => calculateConsistency(today, today), [entries, habits, today]);
    const thisWeekStart = startOfDay(addDays(today, -((today.getDay() + 6) % 7)));
    const thisWeekStats = React.useMemo(() => calculateConsistency(thisWeekStart, today), [entries, habits, thisWeekStart, today]);
    const last7Stats = React.useMemo(() => calculateConsistency(addDays(today, -6), today), [entries, habits, today]);

    const thisSeasonStats = React.useMemo(() => {
        if (!yearStartDate) return 0;
        const ys = parseISO(yearStartDate);
        const diffTime = Math.abs(today.getTime() - ys.getTime());
        const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
        const currentSeasonIndex = Math.floor((diffWeeks - 1) / 13);
        const seasonStart = addWeeks(ys, currentSeasonIndex * 13);
        return calculateConsistency(seasonStart, today);
    }, [entries, habits, yearStartDate, today]);

    const thisYearStats = React.useMemo(() => {
        if (!yearStartDate) return 0;
        return calculateConsistency(parseISO(yearStartDate), today);
    }, [entries, habits, yearStartDate, today]);

    const MetricCard = ({ title, value }: { title: string, value: number }) => (
        <Paper sx={{ p: 2, flex: 1, textAlign: 'center', minWidth: 140 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Typography>
            <Typography variant="h4" sx={{ mt: 1, color: value >= 80 ? 'success.main' : value >= 50 ? 'warning.main' : 'error.main' }}>
                {value}%
            </Typography>
        </Paper>
    );

    const weeksCount = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const weeks = Array.from({ length: weeksCount }, (_, i) => i);
    const dayRows = React.useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => format(addDays(rangeStart, i), 'eee'));
    }, [rangeStart]);

    const getStatusColor = (date: Date, isWeeklyRow: boolean): string => {
        const dateStr = format(date, 'yyyy-MM-dd');

        if (date > startOfDay(new Date())) return 'grey.900';

        if (isWeeklyRow) return 'grey.800';

        const dayOfWeek = date.getDay();
        const dayEntries = entries.filter(e => e.date === dateStr);

        const activeDailyHabits = habits.filter(h =>
            (h.scheduleType === 'daily' || (h.scheduleType === 'weekly' && h.activeDays && h.activeDays.length > 0)) &&
            (h.startDate ? dateStr >= h.startDate : startOfDay(parseISO(h.createdAt)) <= date) &&
            (!h.activeDays || h.activeDays.length === 0 || h.activeDays.includes(dayOfWeek))
        );

        if (activeDailyHabits.length === 0) return 'grey.900';

        let totalPercentage = 0;
        activeDailyHabits.forEach(h => {
            const entry = dayEntries.find(e => e.habitId === h.id);
            if (entry) {
                totalPercentage += Math.min(entry.completedCount, h.targetCount) / h.targetCount;
            }
        });

        if (totalPercentage >= activeDailyHabits.length) return 'success.main'; // Floating point safety? Usually exact for integers. >= is safer.
        if (totalPercentage > 0) return 'warning.main';
        return 'grey.800';
    };

    const getWeeklyStatusColor = (weekStartIndex: number) => {
        const weekStart = addWeeks(rangeStart, weekStartIndex);
        const weekEnd = addDays(weekStart, 6);

        if (weekStart > startOfDay(new Date())) return 'grey.900';

        const activeWeeklyHabits = habits.filter(h =>
            h.scheduleType === 'weekly' &&
            (!h.activeDays || h.activeDays.length === 0) &&
            (h.startDate ? format(weekEnd, 'yyyy-MM-dd') >= h.startDate : startOfDay(parseISO(h.createdAt)) <= weekEnd)
        );
        if (activeWeeklyHabits.length === 0) return 'grey.900';

        let accumulatedProgress = 0;
        activeWeeklyHabits.forEach(h => {
            const habitEntries = entries.filter(e =>
                e.habitId === h.id &&
                e.date >= format(weekStart, 'yyyy-MM-dd') &&
                e.date <= format(weekEnd, 'yyyy-MM-dd')
            );
            const totalCount = habitEntries.reduce((sum, e) => sum + e.completedCount, 0);
            accumulatedProgress += Math.min(totalCount, h.targetCount) / h.targetCount;
        });

        if (accumulatedProgress >= activeWeeklyHabits.length) return 'success.main';
        if (accumulatedProgress > 0) return 'warning.main';
        return 'grey.800';
    };

    const cellSize = isMobile ? 20 : 12;
    const gap = 4;
    const labelWidth = 80;
    const labelMargin = 8;
    const startOffset = labelWidth + labelMargin;

    return (
        <MainLayout>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" component="h1">Consistency</Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <Select value={range} onChange={(e: SelectChangeEvent) => setRange(e.target.value as TimeRange)}>
                        <MenuItem value="current_year">Current Goal Year</MenuItem>
                        <MenuItem value="prior_year">Prior Goal Year</MenuItem>
                        <MenuItem value="current_season">Current Season</MenuItem>
                        <MenuItem value="prior_season">Prior Season</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
                <MetricCard title="Today" value={todayStats} />
                <MetricCard title="This Week" value={thisWeekStats} />
                <MetricCard title="Last 7 Days" value={last7Stats} />
                <MetricCard title="This Season" value={thisSeasonStats} />
                <MetricCard title="This Year" value={thisYearStats} />
            </Box>

            <Paper sx={{ p: 2, overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
                    {isMobile ? (
                        <>
                            <Box sx={{ display: 'flex', gap: `${gap}px` }}>
                                {dayRows.map(d => <Typography key={d} variant="caption" sx={{ width: cellSize, fontSize: 10, textAlign: 'center' }}>{d.charAt(0)}</Typography>)}
                                <Typography variant="caption" sx={{ width: cellSize, fontSize: 10, textAlign: 'center' }}>WK</Typography>
                            </Box>
                            {weeks.map((w, i) => {
                                const isSeasonStart = (range === 'current_year' || range === 'prior_year') && w > 0 && w % 13 === 0;
                                return (
                                    <Box key={w} sx={{
                                        display: 'flex', alignItems: 'center', gap: `${gap}px`,
                                        mt: isSeasonStart ? 1 : 0,
                                        pt: isSeasonStart ? 1 : 0,
                                        borderTop: isSeasonStart ? `1px solid ${theme.palette.success.main}` : 'none'
                                    }}>
                                        {Array.from({ length: 7 }).map((_, dIndex) => {
                                            const cellDate = addDays(addWeeks(rangeStart, w), dIndex);
                                            return (
                                                <Tooltip key={dIndex} title={format(cellDate, 'MMM d')}>
                                                    <Box sx={{ width: cellSize, height: cellSize, bgcolor: getStatusColor(cellDate, false), borderRadius: '2px' }} />
                                                </Tooltip>
                                            )
                                        })}
                                        <Tooltip title={`Week ${w + 1} Goals`}>
                                            <Box sx={{ width: cellSize, height: cellSize, bgcolor: getWeeklyStatusColor(w), borderRadius: '50%' }} />
                                        </Tooltip>
                                    </Box>
                                )
                            })}
                        </>
                    ) : (
                        <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
                            {/* Unbroken Vertical Lines for Seasons */}
                            {(range === 'current_year' || range === 'prior_year') && [13, 26, 39].map(i => {
                                if (i >= weeks.length) return null;
                                const leftPos = startOffset + (i * (cellSize + gap)) - (gap / 2);
                                return (
                                    <Box key={`line-${i}`} sx={{
                                        position: 'absolute',
                                        left: `${leftPos}px`,
                                        top: 0,
                                        bottom: 0,
                                        width: '1px',
                                        bgcolor: 'success.main',
                                        zIndex: 1,
                                        opacity: 0.8,
                                        pointerEvents: 'none'
                                    }} />
                                );
                            })}

                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="caption" sx={{ width: 80, fontSize: 10, lineHeight: 1, textAlign: 'right', mr: 1, fontWeight: 'bold' }}>Daily Habits</Typography>
                            </Box>

                            {dayRows.map((dayLabel, index) => (
                                <Box key={dayLabel} sx={{ display: 'flex', alignItems: 'center', gap: `${gap}px` }}>
                                    <Typography variant="caption" sx={{ width: 80, fontSize: 10, lineHeight: 1, textAlign: 'right', mr: 1 }}>{dayLabel}</Typography>
                                    {weeks.map(w => {
                                        const cellDate = addDays(addWeeks(rangeStart, w), index);
                                        return (
                                            <Tooltip key={w} title={format(cellDate, 'MMM d')}>
                                                <Box sx={{ width: cellSize, height: cellSize, bgcolor: getStatusColor(cellDate, false), borderRadius: '2px' }} />
                                            </Tooltip>
                                        );
                                    })}
                                </Box>
                            ))}

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: `${gap}px`, mt: 1 }}>
                                <Typography variant="caption" sx={{ width: 80, fontSize: 10, lineHeight: 1, textAlign: 'right', mr: 1 }}>Weekly Habits</Typography>
                                {weeks.map(w => (
                                    <Tooltip key={w} title={`Week of ${format(addWeeks(rangeStart, w), 'MMM d')}`}>
                                        <Box sx={{ width: cellSize, height: cellSize, bgcolor: getWeeklyStatusColor(w), borderRadius: '50%' }} />
                                    </Tooltip>
                                ))}
                            </Box>
                        </Box>
                    )}
                </Box>
            </Paper>
        </MainLayout>
    );
}
