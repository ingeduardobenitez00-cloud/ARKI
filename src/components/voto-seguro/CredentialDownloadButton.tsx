"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileText, ImageIcon } from 'lucide-react';

export function CredentialDownloadButton({ voto }: { voto: any }) {
    const [isGeneratingFormat, setIsGeneratingFormat] = useState<'pdf' | 'png' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleDownload = async (format: 'pdf' | 'png') => {
        if (!containerRef.current) return;
        setIsGeneratingFormat(format);
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
            
            const safeMesa = String(voto.MESA || 'SIN_MESA').trim();
            const fileNameBase = `MESA_${safeMesa}_${voto.CEDULA}`;
            
            if (format === 'pdf') {
                // Dynamically import jsPDF
                const { jsPDF } = await import('jspdf');
                
                // Create an A4 PDF
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });
                
                // Standard ID card size (Credit Card / Credential) is ~85.6mm x 54mm
                // Since our aspect ratio is 800x500 (1.6), we use 86.4mm x 54mm
                const cardWidth = 86.4;
                const cardHeight = 54;
                
                // Place it at the top-left to save paper (10mm margins)
                const xPos = 10;
                const yPos = 10;
                
                pdf.addImage(dataUrl, 'PNG', xPos, yPos, cardWidth, cardHeight);
                
                // Draw a subtle border around it as a cutting guide
                pdf.setDrawColor(200, 200, 200);
                pdf.setLineWidth(0.1);
                pdf.rect(xPos, yPos, cardWidth, cardHeight);
                
                pdf.save(`${fileNameBase}.pdf`);
            } else {
                // Download as PNG
                const link = document.createElement('a');
                link.download = `${fileNameBase}.png`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error(`Error generating credential as ${format}:`, error);
        } finally {
            setIsGeneratingFormat(null);
            if (containerRef.current) containerRef.current.style.display = 'none';
        }
    };

    // If the image doesn't exist, it will just show the text and lines
    return (
        <>
            <div className="flex items-center gap-1">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50" 
                    onClick={() => handleDownload('pdf')}
                    disabled={isGeneratingFormat !== null}
                    title="Descargar PDF (Para imprimir A4)"
                >
                    {isGeneratingFormat === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                </Button>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50" 
                    onClick={() => handleDownload('png')}
                    disabled={isGeneratingFormat !== null}
                    title="Descargar PNG (Formato Imagen)"
                >
                    {isGeneratingFormat === 'png' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                </Button>
            </div>

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
                    <div style={{ position: 'absolute', top: '236px', left: '285px', fontSize: '28px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000' }}>
                        {voto.NOMBRE?.trim()}
                    </div>
                    
                    {/* APELLIDOS */}
                    <div style={{ position: 'absolute', top: '296px', left: '285px', fontSize: '28px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000' }}>
                        {voto.APELLIDO?.trim()}
                    </div>
                    
                    {/* LOCAL DE VOTACIÓN */}
                    <div style={{ position: 'absolute', top: '354px', left: '310px', fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', width: '400px', whiteSpace: 'nowrap', color: '#000', lineHeight: '1.2' }}>
                        {voto.LOCAL?.trim()}
                    </div>
                    
                    {/* MESA N° */}
                    <div style={{ position: 'absolute', top: '418px', left: '275px', fontSize: '28px', fontWeight: 'bold', color: '#000' }}>
                        {String(voto.MESA || '').trim()}
                    </div>
                    
                    {/* ORDEN */}
                    <div style={{ position: 'absolute', top: '418px', left: '640px', fontSize: '28px', fontWeight: 'bold', color: '#000' }}>
                        {String(voto.ORDEN || '').trim()}
                    </div>
                </div>
            </div>
        </>
    );
}
