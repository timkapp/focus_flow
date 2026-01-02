'use client';

import * as React from 'react';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { CircularProgress, Box, Typography, Button, Paper } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType>({ user: null, loading: true, signOut: async () => { } });

export const useAuth = () => React.useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = React.useState<User | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [loginError, setLoginError] = React.useState<string | null>(null);

    React.useEffect(() => {
        // Check if config appears valid before even trying
        if (!auth?.app?.options?.apiKey || auth.app.options.apiKey.includes('...')) {
            console.warn("Invalid API Key detected");
            setError("Invalid Firebase Configuration. Please check src/lib/firebase/config.ts");
            setLoading(false);
            return;
        }

        try {
            const unsubscribe = onAuthStateChanged(auth,
                (user) => {
                    console.log("Auth State Changed:", user ? user.uid : 'null');
                    if (user && user.isAnonymous) {
                        console.warn("Blocking anonymous user session.");
                        auth.signOut();
                        setUser(null);
                    } else {
                        setUser(user);
                    }
                    setLoading(false);
                },
                (err) => {
                    console.error("Auth subscription error", err);
                    setError(err.message);
                    setLoading(false);
                }
            );
            return () => unsubscribe();
        } catch (err: any) {
            console.error("Auth initialization error", err);
            setError(err.message || "Failed to initialize Auth");
            setLoading(false);
        }
    }, []);

    const handleGoogleSignIn = async () => {
        setLoginError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            console.error("Error signing in with Google", error);
            setLoginError(error.message);
        }
    };

    const signOut = async () => {
        try {
            console.log("Signing out...");
            await auth.signOut();
            console.log("Sign out complete, reloading...");
            window.location.reload();
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h5" color="error">Configuration Error</Typography>
                <Typography>{error}</Typography>
                <Typography variant="body2" color="text.secondary">
                    Please ensure Firebase Authentication (Google Provider) is enabled in your console.
                </Typography>
                <Button variant="outlined" onClick={() => window.location.reload()}>Retry</Button>
            </Box>
        );
    }

    if (!user) {
        return (
            <Box sx={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default'
            }}>
                <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, maxWidth: 400, width: '100%' }}>
                    <Typography variant="h4" component="h1" fontWeight="bold">Focus Flow</Typography>
                    <Typography color="text.secondary" align="center">
                        Please sign in to access your dashboard.
                    </Typography>

                    {loginError && (
                        <Typography color="error" variant="body2" align="center" sx={{ bgcolor: 'error.light', color: 'error.contrastText', p: 1, borderRadius: 1, width: '100%' }}>
                            {loginError}
                        </Typography>
                    )}

                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<GoogleIcon />}
                        onClick={handleGoogleSignIn}
                        fullWidth
                    >
                        Sign in with Google
                    </Button>
                </Paper>
            </Box>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
