"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  ExternalLink, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  Share2, 
  Copy, 
  Check, 
  Smartphone,
  Info,
  Vote
} from "lucide-react";
import Link from "next/link";

export default function SimuladorPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRotateTip, setShowRotateTip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const localSimuladorPath = "/simulador_tsje/app.html?ubicacion=59.0.0";

  useEffect(() => {
    // Detectar si está en móvil y en vertical
    const checkOrientation = () => {
      if (typeof window !== "undefined") {
        const isMobile = window.innerWidth < 768;
        const isPortrait = window.innerHeight > window.innerWidth;
        setShowRotateTip(isMobile && isPortrait);
      }
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = localSimuladorPath;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Error al entrar a pantalla completa:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error("Error al salir de pantalla completa:", err);
      });
    }
  };

  const handleShareWhatsApp = () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/simulador` : "https://arki-concejal.web.app/simulador";
    const text = encodeURIComponent(`🗳️ *Practica tu voto en el Simulador Oficial TSJE*\n\n✅ *LISTA 1 - OPCIÓN 5*\n🏛️ *EL ARKI SOTOMAYOR CONCEJAL*\n👤 *CAMILO PÉREZ INTENDENTE*\n\n👉 Accede aquí y prueba la máquina de votación:\n${url}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const handleCopyLink = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/simulador` : "https://arki-concejal.web.app/simulador";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn("Error copiando link:", e);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col h-screen w-screen bg-slate-950 text-white overflow-hidden select-none">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-lg z-20 shrink-0">
        <div className="flex items-center gap-3">
          <Link 
            href="/" 
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all duration-200 border border-slate-700/50"
            title="Volver al Panel"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 font-black text-xs">
              <Vote className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                  Simulador de Votación TSJE
                </h1>
                <span className="hidden md:inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-600 text-white tracking-widest shadow-sm">
                  Lista 1 • Opción 5
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide leading-tight hidden sm:block">
                Asunción 2026 • El Arki Sotomayor Concejal
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Botón Compartir WhatsApp */}
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-medium text-xs transition-all shadow-sm active:scale-95"
            title="Compartir en WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px] font-bold uppercase tracking-wider">Compartir</span>
          </button>

          {/* Botón Copiar Enlace */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-medium text-xs transition-all active:scale-95"
            title="Copiar enlace"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline text-[11px] font-bold text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px] font-bold uppercase tracking-wider">Link</span>
              </>
            )}
          </button>

          {/* Botón Recargar */}
          <button 
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all active:scale-95"
            title="Reiniciar simulador"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Botón Pantalla Completa */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all active:scale-95 hidden sm:flex"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Abrir en pestaña nueva */}
          <a 
            href={localSimuladorPath} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all active:scale-95"
            title="Abrir a pantalla completa en nueva pestaña"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Tip para móviles (rotar a horizontal) */}
      <AnimatePresence>
        {showRotateTip && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2 flex items-center justify-between text-[11px] font-medium z-10 shrink-0"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400 rotate-90 shrink-0" />
              <span>
                <strong>Recomendación:</strong> Gira tu teléfono en <strong>horizontal</strong> para una experiencia idéntica a la máquina real.
              </span>
            </div>
            <button
              onClick={() => setShowRotateTip(false)}
              className="text-amber-300 hover:text-white ml-2 text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20"
            >
              Entendido
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulador Container */}
      <main className="flex-1 relative w-full h-full bg-black overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10 space-y-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full shadow-[0_0_20px_rgba(239,68,68,0.4)]"
            />
            <div className="text-center space-y-1">
              <p className="text-slate-200 font-bold uppercase tracking-widest text-xs animate-pulse">
                Cargando Simulador de Votación...
              </p>
              <p className="text-slate-500 text-[10px] uppercase tracking-widest">
                Lista 1 • Opción 5 • Asunción
              </p>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          id="simulador-iframe"
          src={localSimuladorPath}
          className="w-full h-full border-none bg-black"
          onLoad={() => setIsLoading(false)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Simulador Máquina de Votación TSJE"
        />
      </main>
    </div>
  );
}
