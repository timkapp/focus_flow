'use client';

import * as React from 'react';
import {
  Typography,
  Box,
  Paper,
  Card,
  CardContent,
  Button,
  TextField,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  FormLabel,
  LinearProgress
} from '@mui/material';
import Link from 'next/link';
import EditIcon from '@mui/icons-material/Edit';
import MainLayout from '../components/layout/MainLayout';
import { useYear } from '@/contexts/YearContext';
import { formatDateForUrl, isValidStartDate } from '@/lib/dateUtils';

import { onSnapshot, query, where, doc } from 'firebase/firestore'; // Import missing Firestore functions
import { collections } from '../lib/firebase/converters';
import { useAuth } from '../contexts/AuthContext';
import { Habit, HabitEntry } from '@/types';
import { format, parseISO } from 'date-fns';

function StatusCard({ title, value, subtext }: { title: string, value: string | number, subtext?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h3" component="div" sx={{ fontWeight: 'bold' }}>
          {value}
        </Typography>
        {subtext && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {subtext}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { yearStatus, startDate, setStartDate, loading } = useYear();
  const [dateInput, setDateInput] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [openSettings, setOpenSettings] = React.useState(false);
  const [weekStartDay, setWeekStartDay] = React.useState<number>(1);
  const [todaysHabitsStats, setTodaysHabitsStats] = React.useState<{ total: number, completed: number, progress: number } | null>(null);
  const [upcomingHabits, setUpcomingHabits] = React.useState<Habit[]>([]);

  // Fetch today's habits and calculates progress
  React.useEffect(() => {
    if (!user) return;

    // We need both habits (to know what should be done today) and entries (to know what IS done)
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const dayOfWeek = new Date().getDay(); // 0-6

    const unsubscribeHabits = onSnapshot(collections.habits(user.uid), (habitsSnap) => {
      const habits = habitsSnap.docs.map(d => d.data());

      // Listen to today's entries
      const qEntry = query(collections.entries(user.uid), where('date', '==', todayStr));
      const unsubscribeEntries = onSnapshot(qEntry, (entriesSnap) => {
        const entries = entriesSnap.docs.map(d => d.data());

        // Filter habits active today
        const activeHabits: Habit[] = [];
        const futureHabits: Habit[] = [];

        habits.forEach((h: any) => {
          const effectiveStartDate = h.startDate || format(parseISO(h.createdAt), 'yyyy-MM-dd');
          if (effectiveStartDate > todayStr) {
            futureHabits.push(h);
            return;
          }

          let isActive = false;
          if (h.scheduleType === 'daily') isActive = true;
          else if (h.scheduleType === 'weekly') {
            if (h.activeDays && h.activeDays.length > 0) {
              isActive = h.activeDays.includes(dayOfWeek);
            } else {
              isActive = true;
            }
          }

          if (isActive) activeHabits.push(h);
        });

        setUpcomingHabits(futureHabits);

        if (activeHabits.length === 0) {
          setTodaysHabitsStats({ total: 0, completed: 0, progress: 0 });
          return;
        }

        let completedCount = 0;
        activeHabits.forEach(h => {
          const entry = entries.find(e => e.habitId === h.id);
          // A habit is "completed" for the stats if target is met
          if (entry && entry.completedCount >= h.targetCount) {
            completedCount++;
          }
        });

        const progress = (completedCount / activeHabits.length) * 100;
        setTodaysHabitsStats({
          total: activeHabits.length,
          completed: completedCount,
          progress
        });
      });

      return () => unsubscribeEntries();
    });

    return () => unsubscribeHabits();
  }, [user]);

  const handleSetup = async () => {
    if (!dateInput) return;

    // Parse YYYY-MM-DD manually to ensure local midnight (avoiding UTC timezone shift issues)
    const [year, month, day] = dateInput.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (isNaN(date.getTime())) {
      setError('Invalid date');
      return;
    }

    if (!isValidStartDate(date, weekStartDay)) {
      const expectedDay = weekStartDay === 1 ? 'Monday' : 'Sunday';
      setError(`Start date must be a ${expectedDay}. ${dateInput} is a ${date.toLocaleDateString('en-US', { weekday: 'long' })}.`);
      return;
    }

    setSubmitting(true);
    // Normalize to ISO date string YYYY-MM-DD
    try {
      await setStartDate(dateInput);
      setOpenSettings(false);
    } catch (err: any) {
      console.error("Setup error", err);
      // Check for specific Firestore offline error
      if (err.code === 'unavailable' || err.message.includes('offline')) {
        setError("Network Error: Could not connect to Firestore. Please check your internet connection or Firewall.");
      } else if (err.code === 'permission-denied') {
        setError("Permission Denied: Please check your Firestore Security Rules.");
      } else {
        setError(`Error: ${err.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSettings = () => {
    setDateInput(startDate || '');
    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      const currentDay = new Date(y, m - 1, d).getDay();
      setWeekStartDay(currentDay);
    }
    setOpenSettings(true);
  };

  if (loading) {
    return (
      <MainLayout>
        <Typography>Loading...</Typography>
      </MainLayout>
    );
  }

  if (!startDate || !yearStatus) {
    return (
      <MainLayout>
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 8, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>Welcome to FocusFlow</Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            To begin, please select your Operating Year Start Date. This must be a Monday.
          </Typography>

          <Paper sx={{ p: 4, mt: 4 }}>
            <FormControl component="fieldset" sx={{ mb: 3, display: 'block' }}>
              <FormLabel component="legend">Week Starts On</FormLabel>
              <RadioGroup
                row
                value={weekStartDay}
                onChange={(e) => setWeekStartDay(Number(e.target.value))}
              >
                <FormControlLabel value={0} control={<Radio />} label="Sunday" />
                <FormControlLabel value={1} control={<Radio />} label="Monday" />
              </RadioGroup>
            </FormControl>

            <TextField
              label="Start Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              fullWidth
              value={dateInput}
              onChange={(e) => {
                setDateInput(e.target.value);
                setError('');
              }}
              error={!!error}
              helperText={error}
              sx={{ mb: 3 }}
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleSetup}
              disabled={!dateInput || submitting}
            >
              {submitting ? 'Initializing...' : 'Initialize Operating Year'}
            </Button>
          </Paper>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" color="text.secondary">
            Operating Year Status
          </Typography>
          <IconButton size="small" onClick={handleOpenSettings}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {yearStatus.isOffSystem ? (
        <Alert severity="info" sx={{ mb: 4 }}>
          You are currently in an Off-System day (review or reflection only).
        </Alert>
      ) : null}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          <StatusCard
            title="Current Week"
            value={yearStatus.currentWeek}
            subtext={`Season ${yearStatus.currentSeason}`}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <StatusCard
            title="Day of Week"
            value={7 - yearStatus.daysRemainingInWeek}
            subtext={`${yearStatus.daysRemainingInWeek} days remaining`}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <StatusCard
            title="Review Status"
            value="Pending"
            subtext="Weekly review due Saturday"
          />
        </Box>
      </Box>

      <Box sx={{ mt: 6 }}>
        <Typography variant="h6" gutterBottom>Today's Focus</Typography>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          {todaysHabitsStats ? (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Daily Progress</Typography>
                <Typography variant="body2" fontWeight="bold">{Math.round(todaysHabitsStats.progress)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={todaysHabitsStats.progress} sx={{ height: 10, borderRadius: 5, mb: 2 }} />
              <Typography variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
                {todaysHabitsStats.completed} / {todaysHabitsStats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Habits Completed Today
              </Typography>
              <Button variant="contained" component={Link} href="/habits">
                Go to Habits
              </Button>
            </Box>
          ) : (
            <Typography color="text.secondary">Loading...</Typography>
          )}
        </Paper>
      </Box>



      {/* Edit Configuration Dialog */}
      <Dialog open={openSettings} onClose={() => setOpenSettings(false)}>
        <DialogTitle>Operating Year Configuration</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" paragraph>
              Update your Operating Year Start Date.
            </Typography>

            <FormControl component="fieldset" sx={{ mb: 2, display: 'block' }}>
              <FormLabel component="legend">Week Starts On</FormLabel>
              <RadioGroup
                row
                value={weekStartDay}
                onChange={(e) => setWeekStartDay(Number(e.target.value))}
              >
                <FormControlLabel value={0} control={<Radio />} label="Sunday" />
                <FormControlLabel value={1} control={<Radio />} label="Monday" />
              </RadioGroup>
            </FormControl>

            <TextField
              label="Start Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              fullWidth
              value={dateInput}
              onChange={(e) => {
                setDateInput(e.target.value);
                setError('');
              }}
              error={!!error}
              helperText={error}
              sx={{ mb: 3 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSettings(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSetup} disabled={!dateInput || submitting}>
            {submitting ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  );
}
