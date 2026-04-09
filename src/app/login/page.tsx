
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [logoVersion, setLogoVersion] = useState('');

  useEffect(() => {
    setLogoVersion(Date.now().toString());
  }, []);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const success = await login(email, password);
      if (success) {
        toast({ title: 'Acceso Autorizado', description: 'Iniciando sesión en el sistema estratégico.' });
        router.push('/');
      } else {
        throw new Error('Credenciales inválidas');
      }
    } catch (err: any) {
      toast({
        title: 'Error de Autenticación',
        description: err.message || 'Usuario o contraseña incorrectos.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4 font-medium selection:bg-primary/10">
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-50" />
      
      <Card className="w-full max-w-sm shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border-slate-200/60 rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-xl relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <CardHeader className="text-center pt-8 pb-4 space-y-4">
           <div className="flex flex-col items-center justify-center">
                <div className="relative w-32 h-32 transition-transform duration-700 hover:scale-110 drop-shadow-2xl">
                    <Image 
                      src={`/logo.png?v=${logoVersion}`} 
                      alt="Logo Arki" 
                      fill 
                      className="object-contain" 
                      style={{ imageRendering: '-webkit-optimize-contrast' }}
                      priority 
                    />
                </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-lg font-medium tracking-[0.1em] uppercase text-primary">
                Acceso al Sistema
            </CardTitle>
            <div className="flex flex-col gap-0.5">
                <CardDescription className="font-medium text-[9px] uppercase tracking-[0.3em] text-slate-900 mb-1">
                    LISTA 2P - OPCIÓN 2
                </CardDescription>
                <CardDescription className="font-medium text-[9px] uppercase tracking-[0.2em] text-slate-600">
                    CAMILO PÉREZ INTENDENTE
                </CardDescription>
                <CardDescription className="font-medium text-[9px] uppercase tracking-[0.2em] text-slate-600">
                    EL ARKI SOTOMAYOR CONCEJAL
                </CardDescription>
                <CardDescription className="font-medium text-[8px] uppercase tracking-[0.4em] text-slate-400">
                    ASUNCIÓN PUEDE
                </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 px-8">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Mail className="h-3 w-3" /> Correo Electrónico
              </Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="usuario@ejemplo.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="h-11 border-slate-200 bg-white/50 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all font-medium text-[11px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Lock className="h-3 w-3" /> Contraseña de Seguridad
              </Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="h-11 border-slate-200 bg-white/50 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all font-medium text-[11px]"
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4 pt-6 pb-10 px-8">
            <Button type="submit" className="w-full h-12 rounded-2xl font-medium uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95 group" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    INGRESAR AHORA
                  </>
              )}
            </Button>
            
            <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 opacity-20">
                    <div className="h-px w-6 bg-slate-400" />
                    <div className="h-1 w-1 rounded-full bg-slate-400" />
                    <div className="h-px w-6 bg-slate-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-[8px] text-center text-slate-400 uppercase font-medium tracking-[0.3em] leading-relaxed">
                    AUTORIZADO SOLO PARA EL<br/>EQUIPO DE CAMPAÑA
                  </p>
                  <p className="text-[7px] text-center text-slate-400 uppercase font-medium tracking-[0.2em] opacity-80">
                    DESARROLLADO POR EL ING. EDUARDO BENITEZ
                  </p>
                </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
