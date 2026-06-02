"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

export function CredentialDownloadButton({ voto }: { voto: any }) {
    const [isGenerating, setIsGenerating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        if (!containerRef.current) return;
        setIsGenerating(true);
        try {
            // Un-hide the container temporarily
            containerRef.current.style.display = 'block';
            
            // Dynamically import html2canvas to avoid SSR window issues
            const html2canvasModule = await import('html2canvas');
            const html2canvas = html2canvasModule.default;
            
            const canvas = await html2canvas(containerRef.current, {
                scale: 2, // higher resolution
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            // Re-hide
            containerRef.current.style.display = 'none';

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `Credencial_${voto.CEDULA}_${voto.NOMBRE}.png`;
            link.click();
        } catch (error) {
            console.error('Error generating credential:', error);
        } finally {
            setIsGenerating(false);
            if (containerRef.current) containerRef.current.style.display = 'none';
        }
    };

    // If the image doesn't exist, it will just show the text and lines
    return (
        <>
            <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50" 
                onClick={handleDownload}
                disabled={isGenerating}
                title="Descargar Credencial"
            >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>

            {/* Hidden template for the credential */}
            <div 
                ref={containerRef} 
                style={{
                    display: 'none',
                    position: 'absolute',
                    top: '-9999px',
                    left: '-9999px',
                    width: '800px',
                    height: '500px',
                    backgroundColor: '#ffffff',
                    fontFamily: 'sans-serif',
                    color: '#000000',
                    overflow: 'hidden'
                }}
            >
                {/* Background image - User should place their image at public/credencial.png */}
                <img 
                    src="/credencial.png" 
                    alt="Fondo Credencial" 
                    style={{
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%', 
                        zIndex: 0, 
                        objectFit: 'cover'
                    }} 
                    onError={(e) => { 
                        // If image fails to load, just hide it so we see a white background
                        e.currentTarget.style.display = 'none'; 
                    }} 
                />
                 
                {/* Overlay text */}
                <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
                    {/* NOMBRES */}
                    <div style={{ position: 'absolute', top: '232px', left: '255px', fontSize: '28px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000' }}>
                        {voto.NOMBRE?.trim()}
                    </div>
                    
                    {/* APELLIDOS */}
                    <div style={{ position: 'absolute', top: '294px', left: '255px', fontSize: '28px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000' }}>
                        {voto.APELLIDO?.trim()}
                    </div>
                    
                    {/* LOCAL DE VOTACIÓN */}
                    <div style={{ position: 'absolute', top: '354px', left: '410px', fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', width: '370px', whiteSpace: 'nowrap', color: '#000', lineHeight: '1.2' }}>
                        {voto.LOCAL?.trim()}
                    </div>
                    
                    {/* MESA N° */}
                    <div style={{ position: 'absolute', top: '408px', left: '265px', fontSize: '28px', fontWeight: 'bold', color: '#000' }}>
                        {voto.MESA}
                    </div>
                    
                    {/* ORDEN */}
                    <div style={{ position: 'absolute', top: '408px', left: '710px', fontSize: '28px', fontWeight: 'bold', color: '#000' }}>
                        {voto.ORDEN}
                    </div>
                </div>
            </div>
        </>
    );
}
