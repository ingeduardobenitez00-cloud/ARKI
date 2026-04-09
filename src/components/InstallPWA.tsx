
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share, PlusSquare, X, Smartphone, ArrowBigDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallLink, setShowInstallLink] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    setIsStandalone(isStandaloneMode);

    // Detectar iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Manejar evento de instalación en Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandaloneMode) {
        setShowInstallLink(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Para iOS, mostrar después de un pequeño retraso si no es standalone
    if (ios && !isStandaloneMode) {
      const timer = setTimeout(() => setShowInstallLink(true), 2000);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallLink(false);
    }
  };

  if (!showInstallLink || isStandalone) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-4 right-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80" 
          onClick={() => setShowInstallLink(false)}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="p-8 text-center space-y-6">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
            <Smartphone className="h-10 w-10 text-white" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-black uppercase tracking-tight text-foreground">
              Instalar Aplicación
            </h3>
            <p className="text-sm text-muted-foreground font-medium px-4">
              Accede más rápido y recibe actualizaciones instalando el acceso directo en tu pantalla de inicio.
            </p>
          </div>

          {isIOS ? (
            <div className="bg-muted/50 rounded-2xl p-5 space-y-4 border border-primary/5">
              <p className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center justify-center gap-2">
                Instrucciones para iPhone
              </p>
              <div className="flex flex-col gap-3 text-left">
                <div className="flex items-center gap-3 text-xs font-bold">
                  <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center shadow-sm border">1</div>
                  <span>Pulsa el botón <Share className="inline-block h-4 w-4 text-blue-500 mx-1" /> "Compartir"</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center shadow-sm border">2</div>
                  <span>Selecciona <PlusSquare className="inline-block h-4 w-4 mx-1" /> "Agregar a inicio"</span>
                </div>
              </div>
              <ArrowBigDown className="h-6 w-6 mx-auto text-primary animate-bounce mt-2" />
            </div>
          ) : (
            <Button 
              onClick={handleInstallClick}
              className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
            >
              <Download className="mr-2 h-5 w-5" />
              INSTALAR AHORA
            </Button>
          )}

          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pt-2">
            ARKI SOTOMAYOR - CONCEJAL 2026
          </p>
        </div>
      </div>
    </div>
  );
}
