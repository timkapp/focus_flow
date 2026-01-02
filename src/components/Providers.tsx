'use client';

import * as React from 'react';
import ThemeRegistry from './ThemeRegistry/ThemeRegistry';
import { AuthProvider } from '@/contexts/AuthContext';
import { YearProvider } from '@/contexts/YearContext';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeRegistry>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <AuthProvider>
                    <YearProvider>
                        {children}
                    </YearProvider>
                </AuthProvider>
            </LocalizationProvider>
        </ThemeRegistry>
    );
}
