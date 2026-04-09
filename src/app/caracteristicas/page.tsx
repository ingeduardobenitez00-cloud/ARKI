"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { 
    Cpu, 
    Database, 
    ShieldCheck, 
    Layout, 
    Smartphone, 
    Cloud, 
    Lock, 
    Zap, 
    Code2, 
    Layers, 
    Globe, 
    FileJson,
    UserCheck,
    MessageSquare,
    Camera
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CaracteristicasPage() {
    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-4">
                        <Cpu className="h-10 w-10 text-primary" />
                        Arquitectura del Sistema
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-xs tracking-[0.2em] mt-2">
                        Documentación técnica y capacidades operativas de la plataforma.
                    </p>
                </div>
                <Badge variant="outline" className="px-4 py-2 border-primary/20 bg-primary/5 text-primary font-black uppercase tracking-widest text-[10px]">
                    NÚCLEO v5.2 - ESTABLE
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* STACK TECNOLOGICO */}
                <Card className="border-primary/10 shadow-lg group hover:border-primary/30 transition-all">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                            <Code2 className="h-4 w-4 text-primary" /> Stack Front-End
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <ul className="text-xs font-medium uppercase space-y-3 text-muted-foreground">
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Next.js 15 (App Router)</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> React 18 (Client Components)</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Tailwind CSS (JIT Engine)</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> ShadCN UI & Radix Primitives</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Lucide Icons (Vectores SVG)</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* INFRAESTRUCTURA BACKEND */}
                <Card className="border-primary/10 shadow-lg group hover:border-primary/30 transition-all">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                            <Database className="h-4 w-4 text-primary" /> Infraestructura Cloud
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <ul className="text-xs font-medium uppercase space-y-3 text-muted-foreground">
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Google Firebase Platform</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Firestore (NoSQL Database)</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Realtime Database (Presence)</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Firebase Auth (Secure Tokens)</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> App Hosting (Edge Delivery)</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* SEGURIDAD */}
                <Card className="border-primary/10 shadow-lg group hover:border-primary/30 transition-all lg:col-span-1 md:col-span-2">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" /> Protocolos de Seguridad
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <ul className="text-xs font-medium uppercase space-y-3 text-muted-foreground">
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> RBAC (Role Based Access Control)</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Auditoría Global de Acciones</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Firestore Security Rules v2</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Cifrado de Datos en Tránsito (TLS)</li>
                            <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Control de Sesiones Concurrentes</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3 border-b pb-4">
                    <Layers className="h-6 w-6 text-primary" /> 
                    Capacidades Exclusivas
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Zap className="h-5 w-5 text-primary" />
                            </div>
                            <h3 className="font-black text-sm uppercase">Fragmentación de Multimedia</h3>
                        </div>
                        <p className="text-[11px] font-medium uppercase text-muted-foreground leading-relaxed">
                            Sistema propietario que divide archivos pesados (hasta 20MB) en fragmentos de 800KB para su almacenamiento en Firestore NoSQL, permitiendo una biblioteca multimedia ilimitada sin necesidad de buckets externos.
                        </p>
                    </div>

                    <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-blue-600/10 flex items-center justify-center">
                                <Globe className="h-5 w-5 text-blue-600" />
                            </div>
                            <h3 className="font-black text-sm uppercase">Inteligencia Territorial</h3>
                        </div>
                        <p className="text-[11px] font-medium uppercase text-muted-foreground leading-relaxed">
                            Motor de geolocalización dual que permite capturar coordenadas GPS en tiempo real o fijar ubicaciones mediante interacción directa en mapas vectoriales (Leaflet), con capas de filtrado por cargo y seccional.
                        </p>
                    </div>

                    <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-green-600/10 flex items-center justify-center">
                                <Smartphone className="h-5 w-5 text-green-600" />
                            </div>
                            <h3 className="font-black text-sm uppercase">Capacidad PWA Pro</h3>
                        </div>
                        <p className="text-[11px] font-medium uppercase text-muted-foreground leading-relaxed">
                            Aplicación Web Progresiva instalable en iOS y Android. Incluye Service Workers para gestión de caché, manifiesto de identidad visual y una interfaz "Mobile-First" optimizada para el trabajo de campo.
                        </p>
                    </div>

                    <div className="p-6 rounded-3xl border bg-white shadow-sm space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-red-600/10 flex items-center justify-center">
                                <Camera className="h-5 w-5 text-red-600" />
                            </div>
                            <h3 className="font-black text-sm uppercase">Biometría Visual</h3>
                        </div>
                        <p className="text-[11px] font-medium uppercase text-muted-foreground leading-relaxed">
                            Módulo de captura fotográfica directo desde el hardware del dispositivo, con soporte para conmutación de cámaras frontal/trasera y optimización automática de imagen para perfiles de operador.
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-primary/5 rounded-[2.5rem] p-10 border border-primary/10 relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-4">
                        <Lock className="h-8 w-8 text-primary" />
                        <h3 className="text-2xl font-black uppercase tracking-tight text-primary">Protección de Datos Estratégicos</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                            <p className="font-black text-[10px] uppercase text-primary tracking-widest">Base de Datos ANR</p>
                            <p className="text-[11px] font-medium uppercase text-muted-foreground">Indexación masiva de electores con capacidad de búsqueda multi-palabra y filtrado por seccional.</p>
                        </div>
                        <div className="space-y-2">
                            <p className="font-black text-[10px] uppercase text-primary tracking-widest">Motor de Reportes</p>
                            <p className="text-[11px] font-medium uppercase text-muted-foreground">Generación dinámica de documentos PDF y XLSX en tiempo real, integrando marcas de agua y logos dinámicos.</p>
                        </div>
                        <div className="space-y-2">
                            <p className="font-black text-[10px] uppercase text-primary tracking-widest">Audit Logs</p>
                            <p className="text-[11px] font-medium uppercase text-muted-foreground">Trazabilidad total de operaciones: quién, qué, cuándo y dónde. Cada marca de voto es inmutable.</p>
                        </div>
                    </div>
                </div>
                <div className="absolute -right-20 -bottom-20 opacity-5">
                    <Cpu className="h-80 w-80 text-primary" />
                </div>
            </div>

            <div className="text-center opacity-40">
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-900">
                    SISTEMA GESTIÓN ESTRATÉGICA LISTA 2P - ASUNCIÓN 2026
                </p>
            </div>
        </div>
    );
}
