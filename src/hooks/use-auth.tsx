
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser, useAuth as useFirebaseAuth } from '@/firebase';
import type { User } from '@/types';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { allMenuItems, userRoles } from '@/lib/menu-data';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [appUser, setAppUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const { user: firebaseUser, isUserLoading } = useUser();
  const firebaseAuth = useFirebaseAuth();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (firebaseUser) {
      setIsAuthLoading(true);
      const userRef = doc(db, 'users', firebaseUser.uid);
      
      // Optimizamos usando onSnapshot para aprovechar el caché local de Firestore
      // Esto hace que el inicio de sesión sea mucho más rápido en recargas
      unsubscribe = onSnapshot(userRef, (userDoc) => {
        if (userDoc.exists()) {
          const userData = { id: userDoc.id, ...userDoc.data() } as User;
          
          // Determinar permisos base por rol si no existen
          let permissions = [...(userData.permissions || [])];
          if (userData.role && permissions.length === 0) {
            permissions = userRoles[userData.role]?.permissions || [];
          }
          
          // Permisos obligatorios mínimos
          const mandatory = ['/', '/ayuda', '/perfil'];
          mandatory.forEach(p => {
              if (!permissions.includes(p)) permissions.push(p);
          });

          // Normalización de seccionales
          const rawSecc = userData.seccionales || (userData.seccional ? [userData.seccional] : []);
          const seccionales = rawSecc.map(s => String(s).toUpperCase().replace('SECCIONAL', '').trim());

          setAppUser({ ...userData, permissions, seccionales });
        } else {
          // Si el documento no existe pero hay sesión de Auth, algo está mal
          console.warn(`Perfil no encontrado para el usuario: ${firebaseUser.uid}`);
          setAppUser(null);
        }
        setIsAuthLoading(false);
      }, (error) => {
        console.error("Error en sincronización de perfil:", error);
        setIsAuthLoading(false);
      });
    } else {
      setAppUser(null);
      if (!isUserLoading) setIsAuthLoading(false);
    }

    return () => unsubscribe();
  }, [firebaseUser, isUserLoading, db]);

  useEffect(() => {
    const isLoadingCombined = isAuthLoading || isUserLoading;
    if (isLoadingCombined) return;

    const publicRoutes = ['/login', '/inscripcion'];

    if (!appUser && !publicRoutes.includes(pathname)) {
        router.replace('/login');
    } else if (appUser) {
        if (pathname === '/login') {
            router.replace('/');
        } else if (pathname !== '/' && !publicRoutes.includes(pathname) && appUser.permissions && !appUser.permissions.includes(pathname)) {
            router.replace('/');
        }
    }
  }, [appUser, isAuthLoading, isUserLoading, pathname, router]);


  const login = useCallback(async (email: string, pass: string): Promise<boolean> => {
    try {
        await signInWithEmailAndPassword(firebaseAuth, email, pass);
        return true;
    } catch (error: any) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
             throw new Error("Usuario o contraseña incorrectos.");
        }
        throw error;
    }
  }, [firebaseAuth]);
  
  const logout = useCallback(async () => {
    await signOut(firebaseAuth).catch(() => {});
    setAppUser(null);
    router.push('/login');
  }, [firebaseAuth, router]);

  const value = useMemo(() => ({
    user: appUser,
    isAuthenticated: !!appUser,
    login,
    logout,
    isLoading: isAuthLoading || isUserLoading,
  }), [appUser, isAuthLoading, isUserLoading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
