
"use client";

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChevronRight, Loader2, Sparkles, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { allMenuItems, menuCategories } from '@/lib/menu-data';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

export default function PanelControlPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
       router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const groupedModules = useMemo(() => {
    if (!user || !user.permissions) return [];
    
    return menuCategories.map(cat => {
      const items = allMenuItems.filter(item => 
        cat.items.includes(item.href) && user.permissions.includes(item.href) && item.href !== '/'
      );
      return { ...cat, items };
    }).filter(cat => cat.items.length > 0 && cat.label !== 'Principal');
  }, [user]);

  if (isLoading || !isAuthenticated) {
    return (
       <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (groupedModules.length === 0) {
    return (
        <div className="space-y-12 text-center py-32 px-4 max-w-2xl mx-auto">
            <div className="space-y-4">
                <div className="inline-flex p-4 rounded-full bg-slate-100 text-slate-400 mb-4">
                    <LayoutGrid className="h-12 w-12" />
                </div>
                <h1 className="text-3xl font-medium uppercase tracking-tight text-slate-900">Panel de Control</h1>
                <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">LISTA 2P - OPCIÓN 2</p>
            </div>
            <div className="p-10 border border-dashed rounded-[2.5rem] bg-white shadow-sm">
                <p className="font-medium text-slate-500 uppercase text-[11px] tracking-widest leading-relaxed">
                    No posee módulos autorizados en este momento.<br/>
                    Por favor, contacte con el Administrador del Sistema.
                </p>
            </div>
        </div>
    )
  }
  
  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 font-medium">
      <div className="flex flex-col gap-4 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-4 justify-center sm:justify-start">
                <div className="h-12 w-1 bg-primary rounded-full shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
                <div>
                    <h1 className="text-2xl sm:text-3xl font-medium uppercase tracking-tighter text-slate-900 flex items-center gap-3">
                        Panel de Control
                        <Sparkles className="h-5 w-5 text-primary opacity-50" />
                    </h1>
                    <p className="text-slate-900 font-medium text-[11px] uppercase tracking-[0.15em] leading-none mt-2">
                        Bienvenido, <span className="text-primary font-bold">{user?.name}</span>. Selecciona una categoría para desplegar sus módulos operativos.
                    </p>
                </div>
            </div>
            <div className="hidden lg:flex items-center gap-2">
                <Badge variant="outline" className="px-4 py-1.5 font-medium border-slate-200 bg-white text-slate-500 uppercase text-[9px] tracking-widest">
                    USUARIO: {user?.username}
                </Badge>
                <Badge variant="outline" className="px-4 py-1.5 font-medium border-slate-200 bg-white text-primary uppercase text-[9px] tracking-widest">
                    {user?.role}
                </Badge>
            </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Accordion type="single" collapsible className="space-y-6">
            {groupedModules.map((category) => (
                <AccordionItem 
                    key={category.label} 
                    value={category.label} 
                    className="border-none"
                >
                    <AccordionTrigger className="hover:no-underline p-0 group [&_svg]:hidden">
                        <div className="flex items-center gap-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-[1.5rem] px-8 py-5 transition-all shadow-sm group-data-[state=open]:bg-primary group-data-[state=open]:text-white group-data-[state=open]:border-primary group-data-[state=open]:shadow-[0_10px_25px_-5px_rgba(239,68,68,0.2)]">
                            <category.icon className="h-5 w-5 shrink-0 opacity-70 group-data-[state=open]:opacity-100" />
                            <span className="text-[13px] font-medium uppercase tracking-[0.15em] leading-none">{category.label}</span>
                            <Badge 
                                variant="secondary" 
                                className="ml-2 font-medium text-[9px] bg-slate-100 text-slate-600 border-slate-200 group-data-[state=open]:bg-white/20 group-data-[state=open]:text-white group-data-[state=open]:border-white/20"
                            >
                                {category.items.length} MÓDULOS
                            </Badge>
                            <ChevronRight className="ml-auto h-5 w-5 transition-transform duration-500 group-data-[state=open]:rotate-90 opacity-40 group-data-[state=open]:opacity-100" />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-8 pb-4">
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 px-4">
                            {category.items.map((mod) => (
                                <Link key={mod.href} href={mod.href} className="group block">
                                    <Card className="h-full border border-slate-100 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] hover:border-primary/20 rounded-[2rem] bg-white overflow-hidden group-hover:-translate-y-1">
                                        <CardHeader className="pt-6 pb-2">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 rounded-2xl bg-slate-50 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-500 border border-slate-100 group-hover:border-primary/10">
                                                    <mod.icon className="w-5 h-5" />
                                                </div>
                                                <CardTitle className="text-[11px] font-medium uppercase tracking-widest leading-tight text-slate-800 group-hover:text-primary transition-colors">{mod.label}</CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pb-6 pt-2">
                                            <CardDescription className="font-medium text-[10px] leading-relaxed text-slate-400 line-clamp-2 uppercase tracking-tight group-hover:text-slate-500">
                                                {mod.tooltip}
                                            </CardDescription>
                                            <div className="mt-4 flex items-center justify-end">
                                                <div className="h-8 w-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-75 group-hover:scale-100 shadow-sm">
                                                    <ChevronRight className="w-4 h-4 text-primary" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      </div>

      <div className="text-center pt-24 pb-8 space-y-4">
        <div className="flex flex-col items-center justify-center gap-2 opacity-40">
            <p className="text-[9px] font-medium uppercase tracking-[0.3em] text-slate-900 mb-1">
                LISTA 2P - OPCIÓN 2
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-primary">
                CAMILO PÉREZ INTENDENTE - EL ARKI SOTOMAYOR CONCEJAL
            </p>
            <p className="text-[9px] font-medium uppercase tracking-[0.5em] text-slate-400">
                ASUNCIÓN PUEDE
            </p>
        </div>
      </div>
    </div>
  );
}
