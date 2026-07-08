import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type NearbyMarket } from "@workspace/api-client-react";
import { useTheme } from "next-themes";

interface MarketMapProps {
  userCoords: { lat: number; lng: number };
  markets: NearbyMarket[];
}

export default function MarketMap({ userCoords, markets }: MarketMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const { theme } = useTheme();

  // Create Map instance
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      // Initialize map
      const map = L.map(mapContainerRef.current, {
        center: [userCoords.lat, userCoords.lng],
        zoom: 9,
        zoomControl: true,
      });

      mapRef.current = map;

      // Add Layer Group for markers
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map tiles based on theme or initial mount
  useEffect(() => {
    if (!mapRef.current) return;

    // Select tile URL based on theme
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const tileUrl = isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    // Remove existing tile layers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current?.removeLayer(layer);
      }
    });

    L.tileLayer(tileUrl, { attribution }).addTo(mapRef.current);
  }, [theme]);

  // Update user coordinate view & markers
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    // Clear previous markers
    markersLayer.clearLayers();

    // 1. Add User Marker
    const userIcon = L.divIcon({
      html: `
        <div class="relative flex h-6 w-6 items-center justify-center">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500 border-2 border-white shadow-sm"></span>
        </div>
      `,
      className: "custom-user-marker",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const userMarker = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
      .bindPopup(`
        <div class="p-1 font-sans text-sm text-gray-900">
          <p class="font-bold text-blue-600">You are here</p>
          <p class="text-xs text-gray-500">${userCoords.lat.toFixed(4)}°N, ${userCoords.lng.toFixed(4)}°E</p>
        </div>
      `);
    markersLayer.addLayer(userMarker);

    // 2. Add Mandi Markers
    markets.forEach((m) => {
      const lat = m.latitude;
      const lng = m.longitude;
      if (lat === null || lat === undefined || lng === null || lng === undefined) return;

      const mandiIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-700 hover:scale-110 active:scale-95 text-white shadow-lg border border-white transition-all cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-store"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M30 7v3a3 3 0 0 1-6 0v-3"/></svg>
          </div>
        `,
        className: "custom-mandi-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      const popupContent = `
        <div class="p-1.5 font-sans min-w-[180px] text-gray-900">
          <h4 class="font-bold text-gray-900 text-sm mb-0.5 leading-snug">${m.name}</h4>
          <p class="text-xs text-gray-500 mb-1.5">${m.district}, ${m.state}</p>
          <div class="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
            <span class="px-1.5 py-0.5 bg-gray-100 rounded font-medium text-gray-600 capitalize">${m.type}</span>
            <span class="font-bold text-emerald-600">${m.distanceKm} km away</span>
          </div>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: mandiIcon })
        .bindPopup(popupContent, { closeButton: false });
      markersLayer.addLayer(marker);
    });

    // 3. Zoom / Fit bounds
    const allCoords: L.LatLngExpression[] = [[userCoords.lat, userCoords.lng]];
    markets.forEach((m) => {
      if (m.latitude !== null && m.latitude !== undefined && m.longitude !== null && m.longitude !== undefined) {
        allCoords.push([m.latitude, m.longitude]);
      }
    });

    if (allCoords.length > 1) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40] });
    } else {
      map.setView([userCoords.lat, userCoords.lng], 9);
    }
  }, [userCoords, markets]);

  return (
    <div className="relative w-full rounded-xl border overflow-hidden shadow-inner bg-muted/20">
      <div ref={mapContainerRef} className="h-[400px] w-full z-0" />
    </div>
  );
}
