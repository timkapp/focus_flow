'use client';

import * as React from 'react';
import { Box, Typography, IconButton, Checkbox, Grid, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import { Milestone } from '@/types';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MilestoneRowProps {
    milestone: Milestone;
    onToggle: (milestone: Milestone, achieved: boolean) => void;
    onEdit: (milestone: Milestone) => void;
    isBlocked?: boolean;
}

export default function MilestoneRow({ milestone, onToggle, onEdit, isBlocked = false }: MilestoneRowProps) {
    const isAchieved = !!milestone.achievedDate;

    return (
        <Box sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: isAchieved ? 'action.hover' : (isBlocked ? 'action.selected' : 'background.paper'),
            '&:last-child': { borderBottom: 0 },
            transition: 'background-color 0.3s',
            opacity: isBlocked ? 0.7 : 1
        }}>
            <Grid container alignItems="center" spacing={2}>
                <Grid item xs={1}>
                    {isBlocked ? (
                        <Tooltip title="Waiting for predecessor">
                            <Box component="span" sx={{ display: 'inline-block' }}>
                                <IconButton disabled size="small" sx={{ p: '9px' }}>
                                    <LockIcon color="disabled" sx={{ fontSize: 28 }} />
                                </IconButton>
                            </Box>
                        </Tooltip>
                    ) : (
                        <Checkbox
                            checked={isAchieved}
                            onChange={(e) => onToggle(milestone, e.target.checked)}
                            color="success"
                            sx={{ '& .MuiSvgIcon-root': { fontSize: 28 } }}
                        />
                    )}
                </Grid>

                <Grid item xs={9} sm={10}>
                    <Box
                        onClick={() => onEdit(milestone)}
                        sx={{
                            cursor: 'pointer',
                            opacity: isAchieved ? 0.6 : 1,
                            transition: 'opacity 0.2s',
                            '&:hover .milestone-name': { color: 'primary.main' }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <Typography className="milestone-name" variant="body1" sx={{
                                fontWeight: 500,
                                textDecoration: isAchieved ? 'line-through' : 'none',
                                transition: 'color 0.2s',
                                mr: 1
                            }}>
                                {milestone.name}
                                {isBlocked && (
                                    <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 1, fontWeight: 'bold' }}>
                                        (Blocked)
                                    </Typography>
                                )}
                            </Typography>

                            {!isAchieved && milestone.targetDate && (
                                <Typography
                                    variant="caption"
                                    color={isBefore(parseISO(milestone.targetDate), startOfDay(new Date())) ? 'error.main' : 'text.secondary'}
                                    sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}
                                >
                                    • Target: {format(parseISO(milestone.targetDate), 'MMM d, yyyy')}
                                </Typography>
                            )}
                        </Box>
                        {milestone.description && (
                            <Box sx={{ mt: 1 }} onClick={(e) => e.stopPropagation()}>
                                <div className="markdown-body" style={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {milestone.description}
                                    </ReactMarkdown>
                                </div>
                            </Box>
                        )}
                        {isAchieved && milestone.achievedDate && (
                            <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5, fontWeight: 'bold' }}>
                                Achieved on {format(parseISO(milestone.achievedDate), 'MMM d, yyyy')}
                            </Typography>
                        )}
                    </Box>
                </Grid>

                {/* Optional: Edit Icon explicitly if user prefers not to click text, 
                     but we follow the "click text to edit" pattern. 
                     Maybe just show it on hover? For consistency with Habits, we removed it.
                     But let's keep it simple.
                 */}
            </Grid>
        </Box>
    );
}
