'use client';

import * as React from 'react';
import {
    Typography,
    Box,
    Paper,
    CircularProgress,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Divider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import MainLayout from '../../components/layout/MainLayout';
import HabitRow from '../../components/habits/HabitRow';
import { useAuth } from '@/contexts/AuthContext';
import { collections } from '@/lib/firebase/converters';
import { onSnapshot, query, where, orderBy, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Habit, HabitEntry, Area } from '@/types';
import { format, addDays, isSameDay, startOfDay, parseISO } from 'date-fns';

export default function HabitsPage() {
    const { user } = useAuth();
    const [habits, setHabits] = React.useState<Habit[]>([]);
    const [areas, setAreas] = React.useState<Area[]>([]);
    const [entries, setEntries] = React.useState<HabitEntry[]>([]);
    const [loading, setLoading] = React.useState(true);

    // UI State
    const [openAddHabit, setOpenAddHabit] = React.useState(false);
    const [openManageAreas, setOpenManageAreas] = React.useState(false);
    const [newHabitStartDate, setNewHabitStartDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
    const [showInactiveHabits, setShowInactiveHabits] = React.useState(false);

    // Date state
    const [selectedDate, setSelectedDate] = React.useState(new Date());
    const dateKey = format(selectedDate, 'yyyy-MM-dd');

    // Fetch Areas
    React.useEffect(() => {
        if (!user) return;
        const q = query(collections.areas(user.uid), orderBy('order', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAreas(snapshot.docs.map(doc => doc.data()));
        });
        return () => unsubscribe();
    }, [user]);

    // Fetch Habits
    React.useEffect(() => {
        if (!user) return;
        const q = query(collections.habits(user.uid), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHabits(snapshot.docs.map(doc => doc.data()));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // Fetch Entries for the entire week of the selected date
    React.useEffect(() => {
        if (!user) return;
        // Calculate start (Monday) and end (Sunday) of the selected week
        const currentDay = selectedDate.getDay(); // 0 is Sunday
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const startOfWeek = addDays(selectedDate, diffToMonday);
        const endOfWeek = addDays(startOfWeek, 6);

        const startStr = format(startOfWeek, 'yyyy-MM-dd');
        const endStr = format(endOfWeek, 'yyyy-MM-dd');

        const q = query(collections.entries(user.uid), where('date', '>=', startStr), where('date', '<=', endStr));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEntries(snapshot.docs.map(doc => doc.data()));
        });
        return () => unsubscribe();
    }, [user, dateKey]); // Depend on dateKey effectively regenerates range when day changes

    const handleToggle = async (habitId: string, count: number) => {
        if (!user) return;
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        const effectiveStartDate = habit.startDate || format(parseISO(habit.createdAt), 'yyyy-MM-dd');
        if (dateKey < effectiveStartDate) {
            alert('Cannot track habit before its start date.');
            return;
        }

        // Logic for Weekly (Any Day) habits:
        // We are toggling the TOTAL count for the week. We need to find where to add/subtract this count.
        // Simplified approach: All clicks on "Weekly" habits today just add/subtract from TODAY's entry,
        // but the display shows the sum of the week.

        const isWeeklyAnyDay = habit.scheduleType === 'weekly' && (!habit.activeDays || habit.activeDays.length === 0);

        if (isWeeklyAnyDay) {
            // For weekly habits, 'count' passed here is the TARGET total the user clicked on.
            // We need to figure out the delta required to reach that total.
            // But actually, HabitRow passes the *target* circle index (1, 2, 3..).

            // Calculate current total for the week
            const weekEntries = entries.filter(e => e.habitId === habitId);
            const currentTotal = weekEntries.reduce((sum, e) => sum + e.completedCount, 0);

            // We want to reach 'count'.
            // If dragging UP (count > currentTotal), add difference to TODAY.
            // If dragging DOWN (count < currentTotal), subtract difference from TODAY (and potentially others if today becomes < 0? No, let's keep it simple: subtract from today, clamping at 0, then maybe warn if we need to edit past days).
            // Actually, simplest UX: Any interaction changes TODAY's value to align the total.

            const otherDaysTotal = currentTotal - (entries.find(e => e.habitId === habitId && e.date === dateKey)?.completedCount || 0);
            let newTodayCount = count - otherDaysTotal;

            if (newTodayCount < 0) newTodayCount = 0; // Prevent negative today counts. This implies we can't "undo" past days from today's view, which is safe.

            const entryRef = doc(collections.entries(user.uid), `${habitId}_${dateKey}`);
            const entryData: HabitEntry = {
                habitId,
                date: dateKey,
                completedCount: newTodayCount,
                targetMet: false // Weekly target met is calculated dynamically
            };
            await setDoc(entryRef, entryData);

        } else {
            // Standard Daily / Specific Day behavior
            const currentEntry = entries.find(e => e.habitId === habitId && e.date === dateKey);
            const currentCount = currentEntry?.completedCount || 0;
            let newCount = count;
            // If clicking the exact same count that is already selected (cur == count), toggle it off (-1)
            // But only if it's the max count? No, standard logic:
            if (currentCount === count) newCount = count - 1;

            const entryRef = doc(collections.entries(user.uid), `${habitId}_${dateKey}`);
            const entryData: HabitEntry = {
                habitId,
                date: dateKey,
                completedCount: newCount,
                targetMet: newCount >= habit.targetCount
            };
            await setDoc(entryRef, entryData);
        }
    };

    // --- Area Management ---
    const [newAreaName, setNewAreaName] = React.useState('');
    const handleAddArea = async () => {
        if (!user || !newAreaName.trim()) return;
        await addDoc(collections.areas(user.uid), {
            name: newAreaName,
            order: areas.length,
            description: ''
        } as any);
        setNewAreaName('');
    };

    const handleDeleteArea = async (id: string) => {
        if (!user) return;
        if (confirm('Delete this area? Habits in this area will need to be reassigned.')) {
            try {
                await deleteDoc(doc(collections.areas(user.uid), id));
            } catch (error: any) {
                console.error("Error deleting area:", error);
                alert(`Failed to delete area: ${error.message}`);
            }
        }
    }

    const [editingAreaId, setEditingAreaId] = React.useState<string | null>(null);
    const [editingAreaName, setEditingAreaName] = React.useState('');

    const handleStartEditArea = (area: Area) => {
        setEditingAreaId(area.id);
        setEditingAreaName(area.name);
    };

    const handleSaveEditArea = async () => {
        if (!user || !editingAreaId || !editingAreaName.trim()) return;
        try {
            await setDoc(doc(collections.areas(user.uid), editingAreaId), {
                name: editingAreaName
            }, { merge: true });
            setEditingAreaId(null);
            setEditingAreaName('');
        } catch (error: any) {
            console.error("Error updating area:", error);
            alert(`Failed to update area: ${error.message}`);
        }
    };

    const handleCancelEditArea = () => {
        setEditingAreaId(null);
        setEditingAreaName('');
    };

    // --- Habit Creation ---
    const [newHabitName, setNewHabitName] = React.useState('');
    const [newHabitDesc, setNewHabitDesc] = React.useState('');
    const [newHabitTarget, setNewHabitTarget] = React.useState(1);
    const [newHabitAreaId, setNewHabitAreaId] = React.useState('');
    const [newHabitSchedule, setNewHabitSchedule] = React.useState<'daily' | 'weekly'>('daily');
    const [newHabitDays, setNewHabitDays] = React.useState<number[]>([]);

    // --- Habit Editing ---
    const [openEditHabit, setOpenEditHabit] = React.useState(false);
    const [editingHabit, setEditingHabit] = React.useState<Habit | null>(null);

    const handleEditClick = (habit: Habit) => {
        setEditingHabit(habit);
        // Pre-fill form with habit data
        setNewHabitName(habit.name);
        setNewHabitDesc(habit.description || '');
        setNewHabitTarget(habit.targetCount);
        setNewHabitAreaId(habit.areaId);
        setNewHabitSchedule(habit.scheduleType);
        setNewHabitDays(habit.activeDays || []);
        setNewHabitStartDate(habit.startDate || format(parseISO(habit.createdAt), 'yyyy-MM-dd'));

        setOpenEditHabit(true);
    };

    const handleUpdateHabit = async () => {
        if (!user || !editingHabit || !newHabitName || !newHabitAreaId) return;

        const habitRef = doc(collections.habits(user.uid), editingHabit.id);
        await setDoc(habitRef, {
            ...editingHabit,
            areaId: newHabitAreaId,
            name: newHabitName,
            description: newHabitDesc,
            scheduleType: newHabitSchedule,
            targetCount: newHabitTarget,
            activeDays: newHabitSchedule === 'weekly' ? newHabitDays : [],
            startDate: newHabitStartDate,
            updatedAt: new Date().toISOString()
        });

        setOpenEditHabit(false);
        resetForm();
    };

    const handleDeleteHabit = async () => {
        if (!user || !editingHabit) return;
        if (confirm('Are you sure you want to delete this habit?')) {
            await deleteDoc(doc(collections.habits(user.uid), editingHabit.id));
            setOpenEditHabit(false);
            resetForm();
        }
    };

    const resetForm = () => {
        setEditingHabit(null);
        setNewHabitName('');
        setNewHabitDesc('');
        setNewHabitTarget(1);
        setNewHabitSchedule('daily');
        setNewHabitDays([]);
        setNewHabitAreaId('');
        setNewHabitStartDate(format(new Date(), 'yyyy-MM-dd'));
    };

    const handleAddHabit = async () => {
        if (!user || !newHabitName || !newHabitAreaId) return;

        await addDoc(collections.habits(user.uid), {
            areaId: newHabitAreaId,
            name: newHabitName,
            description: newHabitDesc,
            scheduleType: newHabitSchedule,
            targetCount: newHabitTarget,
            activeDays: newHabitSchedule === 'weekly' ? newHabitDays : [],
            startDate: newHabitStartDate,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        } as any);

        setOpenAddHabit(false);
        resetForm();
    };

    if (loading) return <MainLayout><CircularProgress /></MainLayout>;

    // Group Habits by Area
    const habitsByArea: Record<string, Habit[]> = {};
    const uncategorizedHabits: Habit[] = [];
    const inactiveHabits: Habit[] = [];

    habits.forEach(h => {
        const effectiveStartDate = h.startDate || format(parseISO(h.createdAt), 'yyyy-MM-dd');

        // Future habits: Add to inactive list
        if (effectiveStartDate > dateKey) {
            inactiveHabits.push(h);
            return;
        }

        // Filter out Multi-day habits not scheduled for today
        if (h.scheduleType === 'weekly' && h.activeDays && h.activeDays.length > 0) {
            if (!h.activeDays.includes(selectedDate.getDay())) {
                inactiveHabits.push(h);
                return;
            }
        }

        if (h.areaId && areas.find(a => a.id === h.areaId)) { // Ensure area exists
            if (!habitsByArea[h.areaId]) habitsByArea[h.areaId] = [];
            habitsByArea[h.areaId].push(h);
        } else {
            // Treat 'default' as uncategorized if no area named 'default' exists
            uncategorizedHabits.push(h);
        }
    });

    const totalActiveHabits = Object.values(habitsByArea).reduce((acc, habits) => acc + habits.length, 0) + uncategorizedHabits.length;

    return (
        <MainLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="h4" component="h1" sx={{ minWidth: 200, textAlign: 'center' }}>
                        {format(selectedDate, 'EEEE, MMM d')}
                    </Typography>
                    <IconButton
                        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                        disabled={isSameDay(selectedDate, new Date())}
                    >
                        <ChevronRightIcon />
                    </IconButton>
                    {!isSameDay(selectedDate, new Date()) && (
                        <Button startIcon={<TodayIcon />} onClick={() => setSelectedDate(new Date())} sx={{ ml: 1 }}>
                            Today
                        </Button>
                    )}
                </Box>
                <Box>
                    <Button onClick={() => setOpenManageAreas(true)} sx={{ mr: 2 }}>Manage Areas</Button>
                    <Button variant="contained" onClick={() => setOpenAddHabit(true)}>+ Add Habit</Button>
                </Box>
            </Box>

            {/* Render Areas */}
            {areas.map(area => {
                const areaHabits = habitsByArea[area.id] || [];
                if (areaHabits.length === 0) return null; // Hide empty areas or show placeholder?

                return (
                    <Box key={area.id} sx={{ mb: 4 }}>
                        <Typography variant="h6" color="primary" gutterBottom sx={{ textTransform: 'uppercase', fontSize: '0.875rem', letterSpacing: 1, fontWeight: 'bold' }}>
                            {area.name}
                        </Typography>
                        <Paper>
                            {areaHabits.map(habit => {
                                const dailyEntry = entries.find(e => e.habitId === habit.id && e.date === dateKey);
                                const isWeeklyAnyDay = habit.scheduleType === 'weekly' && (!habit.activeDays || habit.activeDays.length === 0);
                                let currentWeeklyTotal = 0;
                                if (isWeeklyAnyDay) {
                                    currentWeeklyTotal = entries
                                        .filter(e => e.habitId === habit.id)
                                        .reduce((sum, e) => sum + e.completedCount, 0);
                                }

                                return (
                                    <HabitRow
                                        key={habit.id}
                                        habit={habit}
                                        entry={dailyEntry}
                                        onToggle={(count) => handleToggle(habit.id, count)}
                                        onEdit={handleEditClick}
                                        completedCountOverride={isWeeklyAnyDay ? currentWeeklyTotal : undefined}
                                    />
                                );
                            })}
                        </Paper>
                    </Box>
                )
            })}

            {/* Uncategorized */}
            {uncategorizedHabits.length > 0 && (
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', fontSize: '0.875rem', letterSpacing: 1, fontWeight: 'bold' }}>
                        Unassigned
                    </Typography>
                    <Paper>
                        {uncategorizedHabits.map(habit => {
                            const dailyEntry = entries.find(e => e.habitId === habit.id && e.date === dateKey);

                            const isWeeklyAnyDay = habit.scheduleType === 'weekly' && (!habit.activeDays || habit.activeDays.length === 0);
                            let currentWeeklyTotal = 0;
                            if (isWeeklyAnyDay) {
                                currentWeeklyTotal = entries
                                    .filter(e => e.habitId === habit.id)
                                    .reduce((sum, e) => sum + e.completedCount, 0);
                            }

                            return (
                                <HabitRow
                                    key={habit.id}
                                    habit={habit}
                                    entry={dailyEntry}
                                    onToggle={(count) => handleToggle(habit.id, count)}
                                    completedCountOverride={isWeeklyAnyDay ? currentWeeklyTotal : undefined}
                                    onEdit={handleEditClick}
                                />
                            )
                        })}
                    </Paper>
                </Box>
            )}

            {totalActiveHabits === 0 && (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">No active habits for this date.</Typography>
                    {habits.length === 0 && areas.length === 0 && <Typography color="error" sx={{ mt: 2 }}>You need to create an Area first!</Typography>}
                </Box>
            )}

            {inactiveHabits.length > 0 && (
                <Box sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
                    <Button onClick={() => setShowInactiveHabits(!showInactiveHabits)} sx={{ color: 'text.secondary', textTransform: 'none' }}>
                        {showInactiveHabits ? 'Hide' : 'Show'} {inactiveHabits.length} Inactive Habit{inactiveHabits.length > 1 ? 's' : ''} Today
                    </Button>

                    {showInactiveHabits && (
                        <Box sx={{ mt: 2, textAlign: 'left' }}>
                            <Paper sx={{ opacity: 0.7 }}>
                                {inactiveHabits.map(habit => {
                                    const isFuture = (habit.startDate || '') > dateKey;
                                    return (
                                        <Box key={habit.id} sx={{ position: 'relative' }}>
                                            {isFuture && (
                                                <Typography variant="caption" sx={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    right: 0,
                                                    zIndex: 2,
                                                    bgcolor: 'info.main',
                                                    color: 'white',
                                                    px: 1,
                                                    py: 0.5,
                                                    borderBottomLeftRadius: 8
                                                }}>
                                                    Starts {format(parseISO(habit.startDate), 'MMM d')}
                                                </Typography>
                                            )}
                                            <HabitRow
                                                habit={habit}
                                                entry={entries.find(e => e.habitId === habit.id && e.date === dateKey)}
                                                onToggle={(count) => handleToggle(habit.id, count)}
                                                onEdit={handleEditClick}
                                            />
                                        </Box>
                                    );
                                })}
                            </Paper>
                        </Box>
                    )}
                </Box>
            )}


            {/* Add Habit Dialog */}
            <Dialog open={openAddHabit} onClose={() => setOpenAddHabit(false)} fullWidth maxWidth="sm">
                <DialogTitle>Add New Habit</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Area</InputLabel>
                            <Select
                                value={newHabitAreaId}
                                label="Area"
                                onChange={(e) => setNewHabitAreaId(e.target.value)}
                            >
                                {areas.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                            </Select>
                            {areas.length === 0 && <Button size="small" onClick={() => { setOpenAddHabit(false); setOpenManageAreas(true); }}>Create Area First</Button>}
                        </FormControl>

                        <TextField
                            label="Start Date"
                            type="date"
                            fullWidth
                            value={newHabitStartDate}
                            onChange={(e) => setNewHabitStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />

                        <TextField
                            label="Habit Name"
                            fullWidth
                            value={newHabitName}
                            onChange={(e) => setNewHabitName(e.target.value)}
                        />
                        <TextField
                            label="Description (Markdown supported)"
                            fullWidth
                            multiline
                            rows={4}
                            value={newHabitDesc}
                            onChange={(e) => setNewHabitDesc(e.target.value)}
                            helperText="Supports Markdown"
                        />
                        <FormControl fullWidth>
                            <InputLabel>Frequency</InputLabel>
                            <Select
                                value={newHabitSchedule}
                                label="Frequency"
                                onChange={(e) => setNewHabitSchedule(e.target.value as 'daily' | 'weekly')}
                            >
                                <MenuItem value="daily">Daily</MenuItem>
                                <MenuItem value="weekly">Weekly</MenuItem>
                            </Select>
                        </FormControl>

                        {newHabitSchedule === 'weekly' && (
                            <Box>
                                <Typography variant="caption" sx={{ mb: 1, display: 'block' }}>Active Days (Optional - blank means any day)</Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                                        <Box
                                            key={index}
                                            onClick={() => {
                                                if (newHabitDays.includes(index)) {
                                                    setNewHabitDays(newHabitDays.filter(d => d !== index));
                                                } else {
                                                    setNewHabitDays([...newHabitDays, index].sort());
                                                }
                                            }}
                                            sx={{
                                                width: 32, height: 32, borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: newHabitDays.includes(index) ? 'primary.main' : 'action.selected',
                                                color: newHabitDays.includes(index) ? 'primary.contrastText' : 'text.primary',
                                                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem',
                                                '&:hover': { opacity: 0.8 }
                                            }}
                                        >
                                            {day}
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        )}

                        <FormControl fullWidth>
                            <InputLabel>
                                {newHabitSchedule === 'daily' || newHabitDays.length > 0 ? 'Target per Day' : 'Target per Week'}
                            </InputLabel>
                            <Select
                                value={newHabitTarget}
                                label={newHabitSchedule === 'daily' || newHabitDays.length > 0 ? 'Target per Day' : 'Target per Week'}
                                onChange={(e) => setNewHabitTarget(Number(e.target.value))}
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 10, 15, 20].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenAddHabit(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddHabit} disabled={!newHabitName || !newHabitAreaId}>Save</Button>
                </DialogActions>
            </Dialog>

            {/* Manage Areas Dialog */}
            <Dialog open={openManageAreas} onClose={() => setOpenManageAreas(false)} fullWidth maxWidth="sm">
                <DialogTitle>Manage Areas</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 1, mb: 3, display: 'flex', gap: 1 }}>
                        <TextField
                            label="New Area Name"
                            fullWidth
                            value={newAreaName}
                            onChange={(e) => setNewAreaName(e.target.value)}
                        />
                        <Button variant="contained" onClick={handleAddArea} disabled={!newAreaName}>Add</Button>
                    </Box>
                    <List>
                        {areas.map(area => (
                            <React.Fragment key={area.id}>
                                <ListItem
                                    secondaryAction={
                                        editingAreaId === area.id ? (
                                            <Box>
                                                <IconButton edge="end" onClick={handleSaveEditArea} color="primary">
                                                    <SaveIcon />
                                                </IconButton>
                                                <IconButton edge="end" onClick={handleCancelEditArea}>
                                                    <CancelIcon />
                                                </IconButton>
                                            </Box>
                                        ) : (
                                            <Box>
                                                <IconButton edge="end" onClick={() => handleStartEditArea(area)} sx={{ mr: 1 }}>
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton edge="end" onClick={() => handleDeleteArea(area.id)}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Box>
                                        )
                                    }
                                >
                                    {editingAreaId === area.id ? (
                                        <TextField
                                            size="small"
                                            fullWidth
                                            value={editingAreaName}
                                            onChange={(e) => setEditingAreaName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveEditArea();
                                                if (e.key === 'Escape') handleCancelEditArea();
                                            }}
                                            sx={{ mr: 2 }}
                                            autoFocus
                                        />
                                    ) : (
                                        <ListItemText primary={area.name} />
                                    )}
                                </ListItem>
                                <Divider />
                            </React.Fragment>
                        ))}
                        {areas.length === 0 && <Typography color="text.secondary" align="center">No areas defined (e.g., Work, Health, Personal)</Typography>}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenManageAreas(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Edit Habit Dialog */}
            <Dialog open={openEditHabit} onClose={() => setOpenEditHabit(false)} fullWidth maxWidth="sm">
                <DialogTitle>Edit Habit</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Area</InputLabel>
                            <Select
                                value={newHabitAreaId}
                                label="Area"
                                onChange={(e) => setNewHabitAreaId(e.target.value)}
                            >
                                {areas.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                            </Select>
                        </FormControl>

                        <TextField
                            label="Start Date"
                            type="date"
                            fullWidth
                            value={newHabitStartDate}
                            onChange={(e) => setNewHabitStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />

                        <TextField
                            label="Habit Name"
                            fullWidth
                            value={newHabitName}
                            onChange={(e) => setNewHabitName(e.target.value)}
                        />
                        <TextField
                            label="Description (Markdown supported)"
                            fullWidth
                            multiline
                            rows={4}
                            value={newHabitDesc}
                            onChange={(e) => setNewHabitDesc(e.target.value)}
                            helperText="Supports Markdown"
                        />
                        <FormControl fullWidth>
                            <InputLabel>Frequency</InputLabel>
                            <Select
                                value={newHabitSchedule}
                                label="Frequency"
                                onChange={(e) => setNewHabitSchedule(e.target.value as 'daily' | 'weekly')}
                            >
                                <MenuItem value="daily">Daily</MenuItem>
                                <MenuItem value="weekly">Weekly</MenuItem>
                            </Select>
                        </FormControl>

                        {newHabitSchedule === 'weekly' && (
                            <Box>
                                <Typography variant="caption" sx={{ mb: 1, display: 'block' }}>Active Days (Optional - blank means any day)</Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                                        <Box
                                            key={index}
                                            onClick={() => {
                                                if (newHabitDays.includes(index)) {
                                                    setNewHabitDays(newHabitDays.filter(d => d !== index));
                                                } else {
                                                    setNewHabitDays([...newHabitDays, index].sort());
                                                }
                                            }}
                                            sx={{
                                                width: 32, height: 32, borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: newHabitDays.includes(index) ? 'primary.main' : 'action.selected',
                                                color: newHabitDays.includes(index) ? 'primary.contrastText' : 'text.primary',
                                                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem',
                                                '&:hover': { opacity: 0.8 }
                                            }}
                                        >
                                            {day}
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        )}

                        <FormControl fullWidth>
                            <InputLabel>
                                {newHabitSchedule === 'daily' || newHabitDays.length > 0 ? 'Target per Day' : 'Target per Week'}
                            </InputLabel>
                            <Select
                                value={newHabitTarget}
                                label={newHabitSchedule === 'daily' || newHabitDays.length > 0 ? 'Target per Day' : 'Target per Week'}
                                onChange={(e) => setNewHabitTarget(Number(e.target.value))}
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 10, 15, 20].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
                    <Button onClick={handleDeleteHabit} color="error" startIcon={<DeleteIcon />}>
                        Delete Habit
                    </Button>
                    <Box>
                        <Button onClick={() => setOpenEditHabit(false)} sx={{ mr: 1 }}>Cancel</Button>
                        <Button variant="contained" onClick={handleUpdateHabit} disabled={!newHabitName || !newHabitAreaId}>Update</Button>
                    </Box>
                </DialogActions>
            </Dialog>
        </MainLayout>
    );
}
