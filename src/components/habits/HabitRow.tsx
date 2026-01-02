'use client';

import * as React from 'react';
import { Box, Typography, IconButton, Tooltip, Grid } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditIcon from '@mui/icons-material/Edit';
import { Habit, HabitEntry } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface HabitRowProps {
    habit: Habit;
    entry?: HabitEntry;
    onToggle: (index: number) => void;
    onEdit: (habit: Habit) => void;
    completedCountOverride?: number;
}

export default function HabitRow({ habit, entry, onToggle, onEdit, completedCountOverride }: HabitRowProps) {
    const completedCount = completedCountOverride !== undefined ? completedCountOverride : (entry?.completedCount || 0);

    // Generate circles based on targetCount
    const circles = Array.from({ length: habit.targetCount }, (_, i) => i);

    // Determine status color (visual only, for circles)
    const isCompleted = (index: number) => index < completedCount;

    return (
        <Box sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            '&:last-child': { borderBottom: 0 }
        }}>
            <Grid container alignItems="center" spacing={2}>
                <Grid item xs={7} sm={6} md={4}>
                    <Tooltip
                        title={
                            <Box sx={{ p: 1, maxWidth: 300 }}>
                                <div className="markdown-body" style={{ fontSize: '0.875rem' }}>
                                    {habit.description ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {habit.description}
                                        </ReactMarkdown>
                                    ) : (
                                        <Typography variant="body2">
                                            {habit.scheduleType === 'daily' ? 'Daily Habit' : (habit.activeDays && habit.activeDays.length > 0 ? 'Multi-day Habit' : 'Weekly Habit')}
                                        </Typography>
                                    )}
                                </div>
                            </Box>
                        }
                        arrow
                        placement="top-start"
                    >
                        <Box
                            onClick={() => onEdit(habit)}
                            sx={{
                                cursor: 'pointer',
                                '&:hover .habit-name': { color: 'primary.main' }
                            }}
                        >
                            <Typography className="habit-name" variant="body1" sx={{ fontWeight: 500, lineHeight: 1.2, transition: 'color 0.2s' }}>
                                {habit.name}
                            </Typography>
                            <Typography variant="caption" sx={{
                                color: 'text.secondary',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mt: 0.5,
                                textTransform: 'uppercase',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                letterSpacing: '0.5px'
                            }}>
                                {habit.scheduleType === 'daily' ? 'Daily' : (habit.activeDays && habit.activeDays.length > 0 ? 'Multi-day' : 'Weekly')}
                                {habit.scheduleType === 'weekly' && habit.activeDays && habit.activeDays.length > 0 && (
                                    <span>• {habit.activeDays.map(d => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d]).join('')}</span>
                                )}
                            </Typography>
                        </Box>
                    </Tooltip>
                </Grid>

                <Grid item xs={5} sm={6} md={8} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                    {circles.map((index) => {
                        const active = isCompleted(index);
                        return (
                            <Box
                                key={index}
                                onClick={() => onToggle(index + 1)} // Toggle up to this count
                                sx={{
                                    width: 28,
                                    height: 28,
                                    flexShrink: 0,
                                    borderRadius: '50%',
                                    border: '2px solid',
                                    borderColor: active ? 'primary.main' : 'action.disabledBackground',
                                    bgcolor: active ? 'primary.main' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': {
                                        borderColor: 'primary.light',
                                        bgcolor: active ? 'primary.light' : 'rgba(76, 175, 80, 0.08)',
                                        transform: 'scale(1.1)'
                                    }
                                }}
                            />
                        );
                    })}
                </Grid>
            </Grid>
        </Box>
    );
}
