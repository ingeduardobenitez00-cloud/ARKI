
"use client";

import { MapContainer, TileLayer, GeoJSON, Popup, useMap, CircleMarker, useMapEvents, Marker, Polygon, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';

interface SeccionalMapData {
    id: string;
    numero: number;
    distrito_oficial: number;
    zona_id: number;
    zona_nombre: string;
    distrito_nombre: string;
    total_votos_seguros: number;
    meta_objetivo: number;
    lat: number;
    lng: number;
    presidentes_count?: number;
    coordinadores_count?: number;
    dirigentes_count?: number;
}

interface ZonaMapData {
    id: string | number;
    nombre: string;
    boundary?: [number, number][];
}

interface TechnicalMapDisplayProps {
  data: SeccionalMapData[];
  zonas: ZonaMapData[];
  onMapDoubleClick?: (lat: number, lng: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
  selectedId?: string | null;
  selectedZoneId?: string | null;
  isDrawing?: boolean;
  drawingPoints?: [number, number][];
}

const getZoneColor = (zonaId: number | string) => {
    const id = parseInt(String(zonaId));
    if (id === 1) return "#3b82f6"; // Azul - Oeste
    if (id === 2) return "#ef4444"; // Rojo - Centro
    if (id === 3) return "#22c55e"; // Verde - Norte
    if (id === 4) return "#eab308"; // Amarillo - Este
    if (id === 5) return "#a855f7"; // Púrpura - Sur
    return "#94a3b8"; 
};

const getZoneNameFallback = (zonaId: number | string, existingName?: string) => {
    if (existingName && existingName.trim() !== "") return existingName;
    const id = parseInt(String(zonaId));
    const names: Record<number, string> = {
        1: "Z1 OESTE",
        2: "Z2 CENTRO",
        3: "Z3 NORTE",
        4: "Z4 ESTE",
        5: "Z5 SUR"
    };
    return names[id] || 'ZONA NO ASIGNADA';
};

const ZONE_LABELS = [
    { id: 1, name: "ZONA 1\nOESTE", pos: [-25.285, -57.655] as [number, number], color: "#3b82f6" },
    { id: 2, name: "ZONA 2\nCENTRO", pos: [-25.275, -57.615] as [number, number], color: "#ef4444" },
    { id: 3, name: "ZONA 3\nNORTE", pos: [-25.245, -57.575] as [number, number], color: "#22c55e" },
    { id: 4, name: "ZONA 4\nESTE", pos: [-25.305, -57.555] as [number, number], color: "#eab308" },
    { id: 5, name: "ZONA 5\nSUR", pos: [-25.340, -57.625] as [number, number], color: "#a855f7" },
];

function MapEvents({ onDoubleClick, onClick }: { onDoubleClick?: (lat: number, lng: number) => void, onClick?: (lat: number, lng: number) => void }) {
    useMapEvents({
        dblclick(e) {
            if (onDoubleClick) onDoubleClick(e.latlng.lat, e.latlng.lng);
        },
        click(e) {
            if (onClick) onClick(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
}

function ZoomToFit({ data }: { data: SeccionalMapData[] }) {
  const map = useMap();
  useEffect(() => {
    if (data && data.length > 0) {
      const validPoints = data
        .filter(s => typeof s.lat === 'number' && typeof s.lng === 'number' && s.lat !== 0)
        .map(s => [s.lat, s.lng] as L.LatLngExpression);
        
      if (validPoints.length > 0) {
        try {
            const bounds = L.latLngBounds(validPoints);
            map.fitBounds(bounds, { padding: [100, 100], maxZoom: 15 });
        } catch (e) {
            console.warn("Error ajustando límites del mapa:", e);
        }
      }
    }
  }, [data, map]);
  return null;
}

export default function TechnicalMapDisplay({ data, zonas, onMapDoubleClick, onMapClick, selectedId, selectedZoneId, isDrawing, drawingPoints = [] }: TechnicalMapDisplayProps) {
  const [mounted, setMounted] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [mapKey] = useState(() => `map-${Math.random()}`);
  const defaultCenter: [number, number] = [-25.3006, -57.6359];

  useEffect(() => {
    setMounted(true);
    const loadGeoJson = async () => {
        try {
            const response = await fetch('/mapa-asuncion.json');
            if (response.ok) {
                const json = await response.json();
                setGeoJsonData(json);
            }
        } catch (e) {}
    };
    loadGeoJson();
    return () => setMounted(false);
  }, []);

  if (!mounted) return <div className="h-full w-full bg-muted animate-pulse" />;

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const numero = feature.properties.numero;
    const secData = data.find(s => s.numero === numero);
    
    if (secData) {
        const progress = secData.meta_objetivo > 0 ? (secData.total_votos_seguros / secData.meta_objetivo) * 100 : 0;
        const zonaLabel = getZoneNameFallback(secData.zona_id, secData.zona_nombre);
               const popupContent = `
            <div class="p-3 space-y-3 min-w-[240px] font-sans">
                <div class="border-b border-slate-100 pb-2">
                    <h3 class="font-black text-lg uppercase leading-none text-slate-900 tracking-tight">Seccional ${secData.numero}</h3>
                    <p class="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">${zonaLabel}</p>
                </div>
                
                <!-- Votos Seguros Banner -->
                <div style="background: linear-gradient(to right, #fef2f2, #fff1f2); border: 1px solid rgba(254, 205, 211, 0.5); display: flex; align-items: center; justify-content: space-between; border-radius: 12px; padding: 10px;">
                  <div style="display: flex; flex-direction: column;">
                    <span style="color: #f43f5e; font-weight: 900; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;">Votos Seguros</span>
                    <span style="color: #94a3b8; font-size: 10px;">Captación Total</span>
                  </div>
                  <div style="background-color: #ef4444; color: white; font-weight: 900; padding: 4px 10px; border-radius: 8px; font-size: 14px; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);">
                    ${(secData.total_votos_seguros || 0).toLocaleString()}
                  </div>
                </div>

                <!-- Estructura Territorial Grid -->
                <div style="margin-top: 12px;">
                  <p style="color: #94a3b8; font-weight: 900; font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; padding-left: 4px;">Estructura Territorial</p>
                  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 4px;">
                    <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 6px; border-radius: 8px; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                      <span style="color: #64748b; font-size: 8px; font-weight: 700; text-transform: uppercase;">Presidente</span>
                      <span style="color: #0f172a; font-size: 12px; font-weight: 900; margin-top: 4px;">${secData.presidentes_count || 0}</span>
                    </div>
                    <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 6px; border-radius: 8px; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                      <span style="color: #64748b; font-size: 8px; font-weight: 700; text-transform: uppercase;">Coordinador</span>
                      <span style="color: #0f172a; font-size: 12px; font-weight: 900; margin-top: 4px;">${secData.coordinadores_count || 0}</span>
                    </div>
                    <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 6px; border-radius: 8px; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                      <span style="color: #64748b; font-size: 8px; font-weight: 700; text-transform: uppercase;">Dirigente</span>
                      <span style="color: #0f172a; font-size: 12px; font-weight: 900; margin-top: 4px;">${secData.dirigentes_count || 0}</span>
                    </div>
                  </div>
                </div>

                <!-- Progreso de Meta -->
                <div style="margin-top: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 900; text-transform: uppercase;">
                        <span style="color: #64748b;">Progreso de Meta</span>
                        <span style="color: #dc2626;">${progress.toFixed(1)}%</span>
                    </div>
                    <div style="width: 100%; background-color: #f1f5f9; height: 8px; border-radius: 9999px; overflow: hidden; margin-top: 4px;">
                        <div style="background-color: #ef4444; height: 100%; width: ${Math.min(progress, 100)}%"></div>
                    </div>
                </div>
            </div>
        `;
        layer.bindPopup(popupContent);
    }
  };

  const geoJsonStyle = (feature: any) => {
    const numero = feature.properties.numero;
    const secData = data.find(s => s.numero === numero);
    
    const zoneColor = secData?.zona_id ? getZoneColor(secData.zona_id) : (feature.properties.color || "#94a3b8");
    
    return {
        fillColor: zoneColor,
        weight: 1,
        opacity: 0.5,
        color: 'rgba(0,0,0,0.1)',
        fillOpacity: 0.15
    };
  };

  return (
    <MapContainer
      key={mapKey}
      center={defaultCenter}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
      doubleClickZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapEvents onDoubleClick={onMapDoubleClick} onClick={onMapClick} />
      <ZoomToFit data={data} />

      {geoJsonData && (
        <GeoJSON 
            key={`geojson-${data.length}`}
            data={geoJsonData} 
            style={geoJsonStyle} 
            onEachFeature={onEachFeature}
        />
      )}

      {/* Renderizado de Polígonos de Zonas Manuales */}
      {zonas.map(zona => {
          if (!zona.boundary || zona.boundary.length < 3) return null;
          const color = getZoneColor(zona.id);
          const isSelected = selectedZoneId === String(zona.id);

          return (
              <Polygon
                key={`zone-poly-${zona.id}`}
                positions={zona.boundary}
                pathOptions={{
                    fillColor: color,
                    fillOpacity: isSelected ? 0.6 : 0.35,
                    color: isSelected ? 'black' : color,
                    weight: isSelected ? 4 : 2,
                    dashArray: isSelected ? '10, 10' : ''
                }}
              >
                  <Popup>
                    <div class="p-2 text-center">
                        <h3 class="font-black uppercase text-sm" style={{ color }}>{zona.nombre}</h3>
                        <p class="text-[9px] font-bold text-muted-foreground mt-1">LÍMITE ESTRATÉGICO PERSONALIZADO</p>
                    </div>
                  </Popup>
              </Polygon>
          );
      })}

      {/* Línea de dibujo activa para la zona */}
      {isDrawing && drawingPoints.length > 0 && (
          <>
            <Polyline positions={drawingPoints} pathOptions={{ color: 'red', weight: 3, dashArray: '5, 10' }} />
            {drawingPoints.map((p, i) => (
                <CircleMarker key={`draw-pt-${i}`} center={p} radius={4} pathOptions={{ color: 'red', fillColor: 'white', fillOpacity: 1 }} />
            ))}
          </>
      )}

      {ZONE_LABELS.map(zone => (
          <Marker 
            key={`zone-label-${zone.id}`}
            position={zone.pos}
            icon={L.divIcon({
                className: 'custom-zone-label',
                html: `<div style="color: ${zone.color}; font-weight: 900; text-align: center; text-transform: uppercase; font-size: 14px; line-height: 1; text-shadow: 2px 2px 0px white, -2px -2px 0px white, 2px -2px 0px white, -2px 2px 0px white; white-space: nowrap;">${zone.name.replace('\n', '<br/>')}</div>`,
                iconSize: [100, 40],
                iconAnchor: [50, 20]
            })}
            interactive={false}
          />
      ))}

      {data.map((sec) => {
        if (typeof sec.lat !== 'number' || typeof sec.lng !== 'number' || sec.lat === 0) return null;
        
        const color = getZoneColor(sec.zona_id);
        const isSelected = selectedId === sec.id;
        const zonaLabel = getZoneNameFallback(sec.zona_id, sec.zona_nombre);

        return (
          <CircleMarker
            key={`marker-${sec.id}-${sec.lat}-${sec.lng}`}
            center={[sec.lat, sec.lng]}
            radius={isSelected ? 12 : 6}
            pathOptions={{
              fillColor: color,
              color: isSelected ? 'black' : 'white',
              weight: isSelected ? 3 : 1,
              fillOpacity: 1.0
            }}
          >
            <Popup>
              <div className="p-3 min-w-[220px] space-y-3 font-sans">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="font-black text-sm uppercase text-slate-900 tracking-tight leading-none">Seccional {sec.numero}</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest leading-none">{zonaLabel}</p>
                </div>
                
                {/* Votos Seguros Section */}
                <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-rose-100/30 p-2 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-rose-500 tracking-wider">Votos Seguros</span>
                    <span className="text-[8px] font-medium text-slate-400">Captación Total</span>
                  </div>
                  <div className="bg-red-500 text-white font-black px-2.5 py-1 rounded-lg text-xs shadow-sm shadow-red-500/10">
                    {(sec.total_votos_seguros || 0).toLocaleString()}
                  </div>
                </div>

                {/* Estructura Territorial Grid */}
                <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-1">Estructura Territorial</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center flex flex-col justify-between">
                      <span className="text-[8px] font-bold text-slate-500 uppercase">Presidente</span>
                      <span className="text-xs font-black text-slate-950 mt-1">{sec.presidentes_count || 0}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center flex flex-col justify-between">
                      <span className="text-[8px] font-bold text-slate-500 uppercase">Coordinador</span>
                      <span className="text-xs font-black text-slate-950 mt-1">{sec.coordinadores_count || 0}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center flex flex-col justify-between">
                      <span className="text-[8px] font-bold text-slate-500 uppercase">Dirigente</span>
                      <span className="text-xs font-black text-slate-950 mt-1">{sec.dirigentes_count || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
