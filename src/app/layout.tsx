
"use client";

import { AuthProvider, useAuth } from '@/hooks/use-auth';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { allMenuItems, menuCategories } from '@/lib/menu-data';
import { LogOut, Loader2, ChevronRight, UserCircle, Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FirebaseClientProvider } from '@/firebase';
import { cn } from '@/lib/utils';
import { usePresence } from '@/lib/presence';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { InstallPWA } from '@/components/InstallPWA';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { toast } = useToast();
  
  usePresence();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.hostname !== 'localhost') {
      const handleServiceWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  toast({
                    title: "ACTUALIZACIÓN DISPONIBLE",
                    description: "Hay una nueva versión del sistema lista para instalar.",
                    duration: 15000,
                    action: (
                      <Button 
                        variant="default"
                        size="sm"
                        className="font-black text-[10px] uppercase bg-primary hover:bg-primary/90 h-8 px-4"
                        onClick={() => {
                          if (installingWorker) {
                            installingWorker.postMessage({ type: 'SKIP_WAITING' });
                          }
                          window.location.reload();
                        }}
                      >
                        ACTUALIZAR AHORA
                      </Button>
                    ),
                  });
                }
              };
            }
          };
        } catch (error) {
          console.warn('PWA: SW registration skipped');
        }
      };

      window.addEventListener('load', handleServiceWorker);
      return () => window.removeEventListener('load', handleServiceWorker);
    }
  }, [toast]);

  const groupedMenu = useMemo(() => {
    if (!user || !user.permissions) return [];
    
    return menuCategories.map(cat => {
      const permittedItems = allMenuItems.filter(item => 
        cat.items.includes(item.href) && user.permissions.includes(item.href)
      );
      return { ...cat, permittedItems };
    }).filter(cat => cat.permittedItems.length > 0);
  }, [user]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // OPTIMIZACIÓN: Las rutas públicas no deben ser bloqueadas por el cargador de autenticación
  const publicRoutes = ['/login', '/inscripcion'];
  const isPublicRoute = publicRoutes.includes(pathname);

  if (isLoading && !isPublicRoute) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!isAuthenticated) return null;

  const MenuList = (
    <div className="flex flex-col h-full bg-white font-medium">
      <Link 
        href="/" 
        className="p-8 flex flex-col items-center border-b bg-slate-50/50 hover:bg-slate-100/50 transition-all group"
      >
        <div className="relative h-24 w-24 drop-shadow-sm transition-transform group-hover:scale-105 duration-500">
          <Image 
            src="/logo.png?v=3" 
            alt="Logo Arki" 
            fill 
            className="object-contain" 
            style={{ imageRendering: '-webkit-optimize-contrast' }}
            priority 
          />
        </div>
        <div className="mt-4 text-center space-y-1">
            <p className="text-[9px] uppercase tracking-[0.3em] text-slate-900 font-medium">LISTA 2P - OPCIÓN 2</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-medium">CAMILO PÉREZ INTENDENTE</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-medium">EL ARKI SOTOMAYOR CONCEJAL</p>
            <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400 font-medium">ASUNCIÓN PUEDE</p>
        </div>
      </Link>
      
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {groupedMenu.map((category) => (
          <Collapsible key={category.label} className="group/collapsible">
            <CollapsibleTrigger asChild>
              <div 
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-all border border-transparent hover:border-slate-100"
                onClick={() => {
                  if (category.href) {
                    router.push(category.href);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 group-data-[state=open]/collapsible:bg-primary/10 transition-colors">
                    <category.icon className="h-4 w-4 text-slate-600 group-data-[state=open]/collapsible:text-primary" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-700">{category.label}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90 opacity-30" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1 pl-4">
              <div className="border-l border-slate-200 pl-4 py-1 space-y-1 ml-5">
                {category.permittedItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg text-[11px] font-medium uppercase tracking-tight transition-all",
                      pathname === item.href 
                        ? "bg-primary text-white shadow-sm translate-x-1" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1"
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      <div className="p-6 border-t bg-slate-50/50 mt-auto text-center">
        <p className="text-[8px] uppercase tracking-[0.4em] text-slate-400 font-medium">SISTEMA GESTIÓN ESTRATÉGICA</p>
        <p className="text-[7px] uppercase tracking-[0.2em] text-slate-400 font-medium mt-1">DESARROLLADO POR ING. EDUARDO BENITEZ</p>
      </div>
    </div>
  );

  return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc] font-medium">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-4 sm:px-8 shadow-sm">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100 transition-all border bg-white">
                <Menu className="h-5 w-5 text-slate-600" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[320px] sm:w-[360px] border-r shadow-xl">
              {MenuList}
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-3 overflow-hidden">
              <div className="relative h-10 w-10 shrink-0">
                  <Image src="/logo.png?v=3" alt="Logo" fill className="object-contain" />
              </div>
              <div className="flex flex-col justify-center overflow-hidden py-1">
                  <p className="font-medium text-[7px] sm:text-[9px] tracking-[0.3em] uppercase text-slate-900 mb-0.5 leading-none">
                    LISTA 2P - OPCIÓN 2
                  </p>
                  <div className="flex flex-col">
                    <h2 className="font-medium text-[9px] sm:text-[11px] tracking-[0.1em] sm:tracking-[0.25em] uppercase text-primary leading-tight truncate">
                      CAMILO PÉREZ INTENDENTE
                    </h2>
                    <h2 className="font-medium text-[9px] sm:text-[11px] tracking-[0.1em] sm:tracking-[0.25em] uppercase text-primary leading-tight truncate">
                      EL ARKI SOTOMAYOR CONCEJAL
                    </h2>
                  </div>
              </div>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
             <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-400 hidden xs:flex">
                <Bell className="h-4 w-4" />
             </Button>
             
             <div className="flex items-center gap-2 sm:gap-3 border-l pl-2 sm:pl-4 border-slate-200">
                <Link href="/perfil" className="flex items-center gap-3 group">
                    <div className="hidden md:block text-right">
                        <p className="text-[10px] font-bold text-slate-900 uppercase tracking-tight leading-none">{user?.name}</p>
                        <p className="text-[8px] font-medium text-primary uppercase tracking-widest mt-1">{user?.role}</p>
                    </div>
                    <Avatar className="h-9 w-9 border border-slate-200 transition-transform group-hover:scale-105">
                        <AvatarImage src={user?.photoUrl} className="object-cover" />
                        <AvatarFallback className="bg-slate-100 text-slate-500">
                            <UserCircle className="h-5 w-5" />
                        </AvatarFallback>
                    </Avatar>
                </Link>
                
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" 
                    onClick={logout}
                    title="Cerrar Sesión"
                >
                    <LogOut className="h-4 w-4" />
                </Button>
             </div>
          </div>
        </header>

        <main className="flex-1 relative">
          <div className="p-4 sm:p-8 md:p-10 max-w-[1600px] mx-auto relative z-10">
            {children}
          </div>
        </main>
        <InstallPWA />
      </div>
  );
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    const handleChunkError = (e: any) => {
      const errorMsg = e.message || (e.reason && e.reason.message) || "";
      if (errorMsg.includes('ChunkLoadError') || errorMsg.includes('Loading chunk')) {
        window.location.reload();
      }
    };
    
    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);
    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
    };
  }, []);

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <title>ARKI CONCEJAL LISTA 2P OPCION 2</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="theme-color" content="#ef4444" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ARKI 2P" />
        
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" type="image/png" href="/logo.png?v=3" />
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-medium antialiased selection:bg-primary/10 selection:text-primary">
        <FirebaseClientProvider>
            <AuthProvider>
                <AppContent>{children}</AppContent>
            </AuthProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
