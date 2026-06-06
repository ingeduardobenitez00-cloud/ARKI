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
        const { uid, newPassword } = body;
        
        if (!uid || !newPassword) {
            return NextResponse.json({ success: false, error: 'UID and newPassword are required' }, { status: 400 });
        }

        if (newPassword.length < 6) {
             return NextResponse.json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
        }

        // Update user's password in Firebase Authentication
        await admin.auth().updateUser(uid, {
            password: newPassword
        });
        
        return NextResponse.json({ success: true, message: `Password updated successfully` });
    } catch (error: any) {
        console.error('Error updating password:', error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
