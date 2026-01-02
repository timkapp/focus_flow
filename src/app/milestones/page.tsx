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
    MenuItem
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import MainLayout from '../../components/layout/MainLayout';
import MilestoneRow from '../../components/milestones/MilestoneRow';
import { useAuth } from '@/contexts/AuthContext';
import { collections } from '@/lib/firebase/converters';
import { onSnapshot, query, orderBy, addDoc, doc, setDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { Milestone, Area, Habit } from '@/types';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

export default function MilestonesPage() {
    const { user } = useAuth();
    // State
    const [milestones, setMilestones] = React.useState<Milestone[]>([]);
    const [areas, setAreas] = React.useState<Area[]>([]);
    const [loading, setLoading] = React.useState(true);

    // Edit/Add State
    const [openDialog, setOpenDialog] = React.useState(false);
    const [editingId, setEditingId] = React.useState<string | null>(null);

    // Form State
    const [formName, setFormName] = React.useState('');
    const [formDesc, setFormDesc] = React.useState('');
    const [formAreaId, setFormAreaId] = React.useState('');
    const [formDate, setFormDate] = React.useState(''); // Achieved Date
    const [formTargetDate, setFormTargetDate] = React.useState(''); // Target Date
    const [formPredecessorId, setFormPredecessorId] = React.useState('');

    // Fetch Areas
    React.useEffect(() => {
        if (!user) return;
        const q = query(collections.areas(user.uid), orderBy('order', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAreas(snapshot.docs.map(doc => doc.data()));
        });
        return () => unsubscribe();
    }, [user]);

    // Fetch Milestones
    React.useEffect(() => {
        if (!user) return;
        const q = query(collections.milestones(user.uid));
        const unsubscribe = onSnapshot(q, {
            next: (snapshot) => {
                setMilestones(snapshot.docs.map(doc => doc.data()));
                setLoading(false);
            },
            error: (err) => {
                console.error("Error fetching milestones:", err);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [user]);

    // Actions
    const handleOpenAdd = () => {
        setEditingId(null);
        setFormName('');
        setFormDesc('');
        setFormAreaId(areas.length > 0 ? areas[0].id : '');
        setFormDate('');
        setFormTargetDate('');
        setFormPredecessorId('');
        setOpenDialog(true);
    };

    const handleOpenEdit = (m: Milestone) => {
        setEditingId(m.id);
        setFormName(m.name);
        setFormDesc(m.description || '');
        setFormAreaId(m.areaId);
        setFormDate(m.achievedDate ? m.achievedDate : '');
        setFormTargetDate(m.targetDate ? m.targetDate : '');
        setFormPredecessorId(m.predecessorId || '');
        setOpenDialog(true);
    };

    const handleSave = async () => {
        if (!user || !formName || !formAreaId) return;

        try {
            if (editingId) {
                const updateData: any = {
                    areaId: formAreaId,
                    name: formName,
                    description: formDesc,
                    order: 0,
                    id: editingId
                };
                updateData.achievedDate = formDate ? formDate : deleteField();
                updateData.targetDate = formTargetDate ? formTargetDate : deleteField();
                updateData.predecessorId = formPredecessorId || deleteField();

                await setDoc(doc(collections.milestones(user.uid), editingId), updateData, { merge: true });
            } else {
                const addData: any = {
                    areaId: formAreaId,
                    name: formName,
                    description: formDesc,
                    order: 0
                };
                if (formDate) addData.achievedDate = formDate;
                if (formTargetDate) addData.targetDate = formTargetDate;
                if (formPredecessorId) addData.predecessorId = formPredecessorId;

                await addDoc(collections.milestones(user.uid), addData);
            }
            setOpenDialog(false);
        } catch (error: any) {
            console.error("Error saving milestone:", error);
            alert("Failed to save milestone: " + error.message);
        }
    };

    const handleDelete = async () => {
        if (!user || !editingId) return;
        if (confirm('Delete this milestone?')) {
            await deleteDoc(doc(collections.milestones(user.uid), editingId));
            setOpenDialog(false);
        }
    };

    const handleToggle = async (m: Milestone, achieved: boolean) => {
        if (!user) return;

        // Predecessor Check
        if (achieved && m.predecessorId) {
            const predecessor = milestones.find(pm => pm.id === m.predecessorId);
            if (predecessor && !predecessor.achievedDate) {
                alert(`You must complete the milestone "${predecessor.name}" first!`);
                return;
            }
        }

        const ref = doc(collections.milestones(user.uid), m.id);
        const updateData: any = {
            achievedDate: achieved ? new Date().toISOString() : deleteField()
        };
        await setDoc(ref, updateData, { merge: true });
    };

    if (loading) return <MainLayout><CircularProgress /></MainLayout>;

    // Helpers
    const getAreaName = (areaId: string) => areas.find(a => a.id === areaId)?.name || 'Unknown Area';
    const isMilestoneBlocked = (m: Milestone) => !!m.predecessorId && !milestones.find(p => p.id === m.predecessorId)?.achievedDate;

    // Sorting Helper
    const sortMilestones = (list: Milestone[]) => {
        const getDepth = (m: Milestone, visited = new Set<string>()): number => {
            if (!m.predecessorId) return 0;
            if (visited.has(m.id)) return 0;
            visited.add(m.id);
            const parent = milestones.find(p => p.id === m.predecessorId);
            if (!parent || parent.achievedDate) return 0;
            return getDepth(parent, visited) + 1;
        };
        list.sort((a, b) => {
            const aAchieved = !!a.achievedDate;
            const bAchieved = !!b.achievedDate;
            if (aAchieved && !bAchieved) return 1;
            if (!aAchieved && bAchieved) return -1;
            if (aAchieved && bAchieved) return new Date(b.achievedDate!).getTime() - new Date(a.achievedDate!).getTime();
            return getDepth(a) - getDepth(b); // Topological sort for pending
        });
        return list;
    };

    const renderSection = (title: string, sectionMilestones: Milestone[], titleColor: string = 'text.primary') => {
        if (sectionMilestones.length === 0) return null;

        // Group by Area
        const byArea: Record<string, Milestone[]> = {};
        const unassigned: Milestone[] = [];

        sectionMilestones.forEach(m => {
            if (m.areaId) {
                if (!byArea[m.areaId]) byArea[m.areaId] = [];
                byArea[m.areaId].push(m);
            } else {
                unassigned.push(m);
            }
        });

        const populatedAreas = areas.filter(a => byArea[a.id]);

        return (
            <Box sx={{ mb: 6 }}>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: titleColor }}>{title}</Typography>

                {populatedAreas.map(area => (
                    <Box key={area.id} sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" color="primary" sx={{ textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
                            {area.name}
                        </Typography>
                        <Paper>
                            {sortMilestones(byArea[area.id]).map(m => (
                                <Box key={m.id}>
                                    <Box sx={{ px: 2, pt: 1 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Area: <b>{getAreaName(m.areaId)}</b>
                                            {m.predecessorId && (
                                                <span> • Preceded by: {milestones.find(p => p.id === m.predecessorId)?.name}</span>
                                            )}
                                        </Typography>
                                    </Box>
                                    <MilestoneRow
                                        milestone={m}
                                        onToggle={handleToggle}
                                        onEdit={handleOpenEdit}
                                        isBlocked={isMilestoneBlocked(m)}
                                    />
                                </Box>
                            ))}
                        </Paper>
                    </Box>
                ))}

                {unassigned.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
                            Processing (No Area)
                        </Typography>
                        <Paper>
                            {sortMilestones(unassigned).map(m => (
                                <Box key={m.id}>
                                    <Box sx={{ px: 2, pt: 1 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Area: <b>{getAreaName(m.areaId)}</b>
                                        </Typography>
                                    </Box>
                                    <MilestoneRow
                                        milestone={m}
                                        onToggle={handleToggle}
                                        onEdit={handleOpenEdit}
                                        isBlocked={isMilestoneBlocked(m)}
                                    />
                                </Box>
                            ))}
                        </Paper>
                    </Box>
                )}
            </Box>
        );
    };

    // Filter Groups
    const completed = milestones.filter(m => !!m.achievedDate);
    const incomplete = milestones.filter(m => !m.achievedDate);
    const blocked = incomplete.filter(m => isMilestoneBlocked(m));
    const next = incomplete.filter(m => !isMilestoneBlocked(m));

    return (
        <MainLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" component="h1">
                        Milestones
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Milestones should be the natural outcome of habits. They are not independent goals.
                    </Typography>
                </Box>
                <Button variant="contained" onClick={handleOpenAdd}>+ Add Milestone</Button>
            </Box>

            {milestones.length === 0 && (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">No milestones yet.</Typography>
                    {areas.length === 0 && <Typography color="error">Create Areas first.</Typography>}
                </Box>
            )}

            {renderSection('Next', next, 'primary.main')}
            {renderSection('Blocked', blocked, 'warning.main')}
            {renderSection('Completed', completed, 'text.secondary')}

            {/* Add/Edit Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
                <DialogTitle>{editingId ? 'Edit Milestone' : 'Add New Milestone'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Associated Area</InputLabel>
                            <Select
                                value={formAreaId}
                                label="Associated Area"
                                onChange={(e) => setFormAreaId(e.target.value)}
                            >
                                {areas.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField
                            label="Milestone Name"
                            fullWidth
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                        />
                        <TextField
                            label="Description (Markdown supported)"
                            fullWidth
                            multiline
                            rows={4}
                            value={formDesc}
                            onChange={(e) => setFormDesc(e.target.value)}
                            helperText="Supports Markdown"
                        />

                        <FormControl fullWidth>
                            <InputLabel>Predecessor (Optional)</InputLabel>
                            <Select
                                value={formPredecessorId}
                                label="Predecessor (Optional)"
                                onChange={(e) => setFormPredecessorId(e.target.value)}
                            >
                                <MenuItem value=""><em>None</em></MenuItem>
                                {milestones
                                    .filter(m => m.id !== editingId) // Allow predecessors from any area
                                    .map(m => (
                                        <MenuItem key={m.id} value={m.id}>
                                            {m.name}
                                        </MenuItem>
                                    ))
                                }
                            </Select>
                        </FormControl>

                        <DatePicker
                            label="Target Date"
                            value={formTargetDate ? new Date(formTargetDate) : null}
                            onChange={(newValue) => setFormTargetDate(newValue ? newValue.toISOString() : '')}
                            slotProps={{ textField: { fullWidth: true, sx: { mb: 2 } } }}
                        />

                        <DatePicker
                            label="Date Achieved (Optional)"
                            value={formDate ? new Date(formDate) : null}
                            onChange={(newValue) => setFormDate(newValue ? newValue.toISOString() : '')}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    helperText: "Leave blank if not yet achieved"
                                }
                            }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ justifyContent: mapActionJustify(!!editingId) }}>
                    {editingId && (
                        <Button onClick={handleDelete} color="error" startIcon={<DeleteIcon />}>
                            Delete
                        </Button>
                    )}
                    <Box>
                        <Button onClick={() => setOpenDialog(false)} sx={{ mr: 1 }}>Cancel</Button>
                        <Button variant="contained" onClick={handleSave} disabled={!formName || !formAreaId}>Save</Button>
                    </Box>
                </DialogActions>
            </Dialog>
        </MainLayout>
    );
}

function mapActionJustify(isEditing: boolean) {
    return isEditing ? 'space-between' : 'flex-end';
}
