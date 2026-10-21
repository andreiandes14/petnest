import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordinates } from "@/lib/nearby-providers";

export function ShopPinMap({ center, pin, onSelect, disabled, focus }: { focus?: (Coordinates & { zoom: number }) | null; center: Coordinates | null; pin: Coordinates | null; onSelect: (pin: Coordinates) => void; disabled: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const callback = useRef(onSelect);
  const locked = useRef(disabled);
  const positioned = useRef(false);
  const [tileError, setTileError] = useState(false);
  callback.current = onSelect;
  locked.current = disabled;
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current);
    instance.current = map;
    L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).on("tileerror", () => setTileError(true)).on("tileload", () => setTileError(false)).addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      if (locked.current) return;
      const point = event.latlng.wrap();
      callback.current({ latitude: point.lat, longitude: point.lng });
    });
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resize.observe(container.current);
    return () => { resize.disconnect(); map.remove(); instance.current = null; marker.current = null; };
  }, []);
  useEffect(() => {
    if (focus) instance.current?.setView([focus.latitude, focus.longitude], focus.zoom);
    else if (pin) instance.current?.setView([pin.latitude, pin.longitude], 17);
    else if (center) instance.current?.setView([center.latitude, center.longitude], 12);
    else if (!positioned.current) {
      // Last-resort country overview only before any valid view. A city selection
      // supplies its bundled centroid; losing coordinates must never reset it.
      instance.current?.fitBounds([[4, 116], [22, 127]]);
    }
    if (focus || pin || center) positioned.current = true;
  }, [focus?.latitude, focus?.longitude, focus?.zoom, center?.latitude, center?.longitude, pin?.latitude, pin?.longitude]);
  useEffect(() => {
    const map = instance.current;
    if (!map) return;
    if (!pin) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      marker.current = L.marker([pin.latitude, pin.longitude], {
        draggable: true, title: "Selected shop location",
        icon: L.divIcon({ className: "", html: '<div style="width:26px;height:26px;background:#f07b37;border:3px solid white;border-radius:50%;box-shadow:0 1px 6px #333"></div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).addTo(map);
      marker.current.on("dragend", () => {
        const point = marker.current?.getLatLng().wrap();
        if (point && !locked.current) callback.current({ latitude: point.lat, longitude: point.lng });
      });
    } else marker.current.setLatLng([pin.latitude, pin.longitude]);
    if (disabled) marker.current.dragging?.disable(); else marker.current.dragging?.enable();
  }, [pin, disabled]);
  return <>
    <div ref={container} style={{ height: 288 }} className="relative z-0 w-full rounded-xl" aria-label="Shop location map. Zoom, navigate, click to place a pin, or drag the marker." />
    {tileError ? <p className="text-sm" role="status">Map images could not load. Check your connection and retry your city location.</p> : null}
  </>;
}
