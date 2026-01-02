import { db } from './config';
import {
    collection,
    doc,
    QueryDocumentSnapshot,
    SnapshotOptions,
    WithFieldValue,
    DocumentData
} from 'firebase/firestore';
import { Area, Habit, HabitEntry, Milestone, Review } from '@/types';

// Generic converter helper
const createConverter = <T>() => ({
    toFirestore(data: WithFieldValue<T>): DocumentData {
        return data as DocumentData;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
        const data = snapshot.data(options)!;
        return {
            id: snapshot.id,
            ...data
        } as T;
    }
});

export const areaConverter = createConverter<Area>();
export const habitConverter = createConverter<Habit>();
export const habitEntryConverter = createConverter<HabitEntry>();
export const milestoneConverter = createConverter<Milestone>();
export const reviewConverter = createConverter<Review>();

export const collections = {
    areas: (uid: string) => collection(db, `users/${uid}/areas`).withConverter(areaConverter),
    habits: (uid: string) => collection(db, `users/${uid}/habits`).withConverter(habitConverter),
    entries: (uid: string) => collection(db, `users/${uid}/entries`).withConverter(habitEntryConverter),
    milestones: (uid: string) => collection(db, `users/${uid}/milestones`).withConverter(milestoneConverter),
    reviews: (uid: string) => collection(db, `users/${uid}/reviews`).withConverter(reviewConverter),
    settings: (uid: string) => doc(db, `users/${uid}/settings/general`),
};
