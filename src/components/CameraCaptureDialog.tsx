
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCcw, Check, X, Smartphone, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface CameraCaptureDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (base64: string) => void;
}

export function CameraCaptureDialog({ isOpen, onOpenChange, onCapture }: CameraCaptureDialogProps) {
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const stopStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setStep('select');
    }
  }, [isOpen]);

  const startCamera = async (mode: 'user' | 'environment') => {
    setIsLoading(true);
    setFacingMode(mode);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 720 }, height: { ideal: 720 } }
      });
      setHasCameraPermission(true);
      setStep('preview');
      
      // Necesitamos un pequeño delay para asegurar que el componente video esté renderizado
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Acceso Denegado',
        description: 'No se pudo acceder a la cámara. Por favor, verifica los permisos de tu navegador.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Hacemos que el canvas sea cuadrado basado en el video
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = size;
        canvas.height = size;
        
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        
        context.drawImage(video, startX, startY, size, size, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(dataUrl);
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-6 bg-muted/20 border-b">
          <DialogTitle className="flex items-center gap-2 uppercase font-black text-sm tracking-widest">
            <Camera className="h-5 w-5 text-primary" />
            Capturar Foto de Identidad
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
          {step === 'select' ? (
            <div className="space-y-6 w-full text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Selecciona la cámara que deseas utilizar:
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={() => startCamera('user')} 
                  variant="outline" 
                  className="flex flex-col h-32 gap-3 rounded-2xl border-2 hover:bg-primary/5 hover:border-primary/20 group"
                  disabled={isLoading}
                >
                  <UserCircle className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-black text-[10px] uppercase">Cámara Frontal</span>
                </Button>
                <Button 
                  onClick={() => startCamera('environment')} 
                  variant="outline" 
                  className="flex flex-col h-32 gap-3 rounded-2xl border-2 hover:bg-primary/5 hover:border-primary/20 group"
                  disabled={isLoading}
                >
                  <Smartphone className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-black text-[10px] uppercase">Cámara Trasera</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <div className="relative aspect-square w-full max-w-[320px] mx-auto rounded-3xl overflow-hidden bg-black shadow-2xl border-4 border-white">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={cn(
                    "w-full h-full object-cover",
                    facingMode === 'user' ? "scale-x-[-1]" : "" // Espejo para la frontal
                  )}
                />
                <div className="absolute inset-0 pointer-events-none border-[20px] border-black/20 rounded-full" />
              </div>
              
              {!hasCameraPermission && hasCameraPermission !== null && (
                <Alert variant="destructive">
                  <AlertTitle>Error de Cámara</AlertTitle>
                  <AlertDescription>
                    No se detectó flujo de video. Asegúrate de permitir el acceso.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-muted/10 border-t flex flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 font-black uppercase text-[10px]">
            CANCELAR
          </Button>
          {step === 'preview' && (
            <>
              <Button variant="secondary" onClick={() => setStep('select')} className="font-black uppercase text-[10px]">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button onClick={takePhoto} className="flex-1 font-black uppercase text-[10px]">
                <Check className="mr-2 h-4 w-4" /> TOMAR FOTO
              </Button>
            </>
          )}
        </DialogFooter>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
