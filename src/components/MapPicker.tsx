
'use client';

import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';

// Fix for Leaflet marker icon issue in Next.js/Webpack
const RedIcon = L.icon({
  iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapPickerProps {
  lat: number | null;
  lon: number | null;
  onLocationPick: (lat: number, lon: number) => void;
  defaultCenter?: [number, number];
}

function MapEvents({ onLocationPick }: { onLocationPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    dblclick(e) {
      onLocationPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapPicker({ lat, lon, onLocationPick, defaultCenter = [-25.3006, -57.6359] }: MapPickerProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return <div className="h-full w-full bg-muted animate-pulse" />;

  const center: [number, number] = lat && lon ? [lat, lon] : defaultCenter;

  return (
    <MapContainer
      key={`map-${center[0]}-${center[1]}`}
      center={center}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
      doubleClickZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onLocationPick={onLocationPick} />
      <ChangeView center={center} />
      {lat && lon && <Marker position={[lat, lon]} icon={RedIcon} />}
    </MapContainer>
  );
}
