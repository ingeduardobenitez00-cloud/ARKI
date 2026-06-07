"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function SimuladorPage() {
  const [isLoading, setIsLoading] = useState(true);
  const simuladorUrl = "https://simuladoroficial.tsje.gov.py/sufragio.html?ubicacion=261.0.0";

  const handleRefresh = () => {
    setIsLoading(true);
    const iframe = document.getElementById("simulador-iframe") as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shadow-md">
        <div className="flex items-center space-x-3">
          <Link href="/" className="p-2 rounded-full hover:bg-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </Link>
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            Simulador TSJE
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleRefresh}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors text-gray-300"
            title="Recargar Simulador"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <a 
            href={simuladorUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 rounded-full hover:bg-gray-700 transition-colors text-gray-300"
            title="Abrir en nueva pestaña"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative w-full h-full bg-black">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"
            />
            <p className="text-gray-400 font-medium animate-pulse">Cargando Simulador Oficial...</p>
          </div>
        )}
        <iframe
          id="simulador-iframe"
          src={simuladorUrl}
          className="w-full h-full border-none"
          onLoad={() => setIsLoading(false)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Simulador TSJE"
        />
      </main>
    </div>
  );
}
