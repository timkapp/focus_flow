'use client';

import * as React from 'react';
import { getDoc, setDoc } from 'firebase/firestore'; // Import direct methods, will use collections helper later if needed
import { collections } from '@/lib/firebase/converters';
import { useAuth } from './AuthContext';
import { getYearStatus, YearStatus, isValidStartDate, formatDateForUrl } from '@/lib/dateUtils';
import { format } from 'date-fns';

interface YearContextType {
    yearStatus: YearStatus | null;
    startDate: string | null;
    setStartDate: (date: string) => Promise<void>;
    loading: boolean;
}

const YearContext = React.createContext<YearContextType>({
    yearStatus: null,
    startDate: null,
    setStartDate: async () => { },
    loading: true,
});

export const useYear = () => React.useContext(YearContext);

export function YearProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [startDate, setStartDateState] = React.useState<string | null>(null);
    const [yearStatus, setYearStatus] = React.useState<YearStatus | null>(null);
    const [loading, setLoading] = React.useState(true);

    // Fetch start date from settings
    React.useEffect(() => {
        async function fetchSettings() {
            if (!user) return;

            try {
                const settingsRef = collections.settings(user.uid);
                const snapshot = await getDoc(settingsRef);

                if (snapshot.exists()) {
                    const data = snapshot.data();
                    if (data.operatingYearStartDate) {
                        setStartDateState(data.operatingYearStartDate);
                    }
                } else {
                    // Default or prompt user? For now leave null, UI needs to handle setup
                }
            } catch (e) {
                console.error("Failed to fetch settings", e);
            } finally {
                setLoading(false);
            }
        }

        fetchSettings();
    }, [user]);

    // Compute status whenever start date changes (or daily via interval in a real app)
    React.useEffect(() => {
        if (startDate) {
            const status = getYearStatus(startDate);
            setYearStatus(status);
        }
    }, [startDate]);

    const setStartDate = async (date: string) => {
        if (!user) return;
        // Persist to Firestore
        await setDoc(collections.settings(user.uid), { operatingYearStartDate: date }, { merge: true });
        setStartDateState(date);
    };

    return (
        <YearContext.Provider value={{ yearStatus, startDate, setStartDate, loading }}>
            {children}
        </YearContext.Provider>
    );
}
