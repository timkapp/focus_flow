'use client';

import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const pages = [
    { name: 'Dashboard', path: '/' },
    { name: 'Habits', path: '/habits' },
    { name: 'Milestones', path: '/milestones' },
    { name: 'Consistency', path: '/consistency' },
];

import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { signOut, user } = useAuth();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
            <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Container maxWidth="lg">
                    <Toolbar disableGutters>
                        <Typography
                            variant="h6"
                            noWrap
                            component="div"
                            sx={{ mr: 4, display: { xs: 'none', md: 'flex' }, fontWeight: 700, letterSpacing: '.1rem' }}
                        >
                            FocusFlow
                        </Typography>

                        <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
                            {pages.map((page) => (
                                <Link key={page.name} href={page.path} passHref legacyBehavior>
                                    <Button
                                        component="a"
                                        sx={{
                                            my: 2,
                                            color: pathname === page.path ? 'primary.main' : 'text.secondary',
                                            display: 'block',
                                            fontWeight: pathname === page.path ? 700 : 400,
                                        }}
                                    >
                                        {page.name}
                                    </Button>
                                </Link>
                            ))}
                        </Box>
                        {user && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                                <Tooltip title={user.email || 'User'}>
                                    <Avatar src={user.photoURL || undefined} alt={user.email || 'User'} sx={{ width: 32, height: 32 }} />
                                </Tooltip>
                            </Box>
                        )}
                        <Button color="inherit" onClick={signOut}>Sign Out</Button>
                    </Toolbar>
                </Container>
            </AppBar>
            <Box component="main" sx={{ flexGrow: 1, overflow: 'auto' }}>
                <Container maxWidth="lg" sx={{ py: 4 }}>
                    {children}
                </Container>
            </Box>
        </Box>
    );
}
