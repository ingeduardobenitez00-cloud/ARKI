import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if it hasn't been initialized yet
if (!admin.apps.length) {
    try {
        admin.initializeApp();
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { uid } = body;
        
        if (!uid) {
            return NextResponse.json({ success: false, error: 'UID is required' }, { status: 400 });
        }

        // Delete user from Firebase Authentication
        await admin.auth().deleteUser(uid);
        
        return NextResponse.json({ success: true, message: `User ${uid} deleted successfully from Authentication` });
    } catch (error: any) {
        console.error('Error deleting user from Auth:', error);
        
        // If the user doesn't exist in Auth, we can just return success 
        // so the frontend continues to delete the Firestore document.
        if (error.code === 'auth/user-not-found') {
             return NextResponse.json({ success: true, message: 'User not found in Auth, continuing' });
        }
        
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
