import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

if (!admin.apps.length) {
    try {
        admin.initializeApp();
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
}

export async function GET(req: Request) {
    try {
        const db = admin.firestore();
        const docSnap = await db.collection('seccionales_metadata').doc('seccional_34').get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: 'not found' });
        }
        return NextResponse.json({ data: docSnap.data() });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
