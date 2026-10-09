import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, LocateFixed, MapPin } from 'lucide-react';

// Map geometry is a visual road-following preview obtained from public OSRM.
// The existing FastAPI corridor model remains authoritative for optimization,
// 15% detour enforcement and Shapley Value fare calculations.
export default function RouteMap({ nodes = [], trip, pickup, destination, dark = false, step = -1, overlay = false }) {
  const el = useRef(null);
  const map = useRef(null);
  const route = useRef(null);
  const vehicle = useRef(null);
  const bounds = useRef(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const m = L.map(el.current, {
      zoomControl: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([18.86, 73.3], 9);
    map.current = m;
    L.control.zoom({ position: 'topright' }).addTo(m);
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(m);
    tiles.on('tileerror', () => setNotice('Map tiles unavailable. Stop markers and routes remain visible.'));
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      if (bounds.current) m.fitBounds(bounds.current, { padding: [45, 45], maxZoom: 12, animate: false });
    });
    ro.observe(el.current);
    return () => { ro.disconnect(); m.stop(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (route.current) route.current.remove();
    const group = L.layerGroup().addTo(m);
    route.current = group;
    const controller = new AbortController();
    let cancelled = false;

    // Preserve passenger pickup-to-destination order, not node-array order.
    const start = nodes.find(n => n.name === pickup);
    const end = nodes.find(n => n.name === destination);
    const preview = start && end && start.name !== end.name ? [start, end] : nodes;
    const points = trip?.routeCoordinates?.length
      ? trip.routeCoordinates
      : preview.map(n => [n.lat, n.lng]);
    const validPoints = points.filter(p => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
      .map(p => [Number(p[0]), Number(p[1])]);

    const routeColor = dark ? '#22d3ee' : '#1689f9';
    let routeLines = [];
    function drawRoute(linePoints) {
      routeLines.forEach(line => group.removeLayer(line));
      routeLines = [];
      if (!linePoints.length) return;
      // Two strokes create a clear, high-contrast route; the gold palette is
      // also applied by the user's existing premium-theme CSS override.
      routeLines.push(L.polyline(linePoints, {
        color: routeColor, weight: 14, opacity: 0.12,
      }).addTo(group));
      routeLines.push(L.polyline(linePoints, {
        color: routeColor, weight: 5, opacity: 0.95,
        dashArray: trip ? undefined : '8 8',
      }).addTo(group));
      bounds.current = L.latLngBounds(linePoints);
      m.fitBounds(bounds.current, { padding: [55, 55], maxZoom: 12, animate: false });
    }

    drawRoute(validPoints); // Always show an immediate fallback.

    if (validPoints.length >= 2) {
      // OSRM expects longitude,latitude for each waypoint, separated by ';'.
      const coordinates = validPoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
      fetch(url, { signal: controller.signal })
        .then(response => {
          if (!response.ok) throw new Error(`Routing service HTTP ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (cancelled) return;
          if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates?.length) {
            throw new Error('No drivable road route found');
          }
          const roadPoints = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          drawRoute(roadPoints);
        })
        .catch(error => {
          if (cancelled || error.name === 'AbortError') return;
          setNotice('Road route unavailable. Showing a straight-line corridor preview.');
        });
    }

    const selected = [start, end].filter(Boolean);
    const stops = trip?.stops || selected.map((n, i) => ({
      ...n, node: n.name, rider: '',
      type: n.name === pickup ? 'PICKUP' : 'DROPOFF', stopNum: i + 1,
    }));
    stops.forEach(s => {
      const marker = L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: 'stop-marker',
          html: `<span class="${s.type === 'DROPOFF' ? 'drop' : ''}">${Number(s.stopNum) || ''}</span>`,
          iconSize: [32, 32], iconAnchor: [16, 16],
        }),
      }).addTo(group);
      const label = document.createElement('div');
      label.textContent = `${s.type} · ${s.rider ? s.rider + ' · ' : ''}${s.node}`;
      marker.bindPopup(label);
    });

    if (overlay) {
      const off = nodes.find(n => !n.is_mainline);
      const khandala = nodes.find(n => n.name === 'Khandala');
      if (off && khandala) {
        L.polyline([[khandala.lat, khandala.lng], [off.lat, off.lng]], {
          color: '#fbbf24', dashArray: '6 7', weight: 4,
        }).addTo(group).bindTooltip('Vikram scenario · modelled detour');
      }
    }
    return () => { cancelled = true; controller.abort(); };
  }, [nodes, trip, pickup, destination, dark, overlay]);

  useEffect(() => {
    if (vehicle.current) { vehicle.current.remove(); vehicle.current = null; }
    const s = trip?.stops[step];
    if (s && map.current) {
      vehicle.current = L.marker([s.lat, s.lng], {
        zIndexOffset: 1000,
        icon: L.divIcon({ className: 'vehicle-marker', html: '➤', iconSize: [40, 40], iconAnchor: [20, 20] }),
      }).addTo(map.current).bindTooltip('Simulated vehicle · no live GPS');
    }
  }, [trip, step]);

  function locate() {
    if (!navigator.geolocation) return setNotice('Location is not supported in this browser.');
    navigator.geolocation.getCurrentPosition(
      p => {
        map.current?.setView([p.coords.latitude, p.coords.longitude], 13);
        setNotice('Showing device location. Booking remains limited to corridor stops.');
      },
      () => setNotice('Location unavailable or permission denied. Choose a corridor pickup instead.'),
      { timeout: 8000 },
    );
  }

  return <div className={`route-map ${dark ? 'dark-map' : ''}`}>
    <div className="leaflet-host" ref={el} aria-label="Interactive Pune to Mumbai corridor map" />
    <div className="map-label"><MapPin size={14} /> PUNE — MUMBAI <span>NH 48</span></div>
    <div className="map-tools">
      <button title="Fit full route" aria-label="Fit full route" onClick={() => bounds.current && map.current.fitBounds(bounds.current, { padding: [55, 55], animate: false })}><Crosshair size={19}/></button>
      <button title="My location" aria-label="My location" onClick={locate}><LocateFixed size={19}/></button>
    </div>
    <div className="map-disclaimer">{trip ? 'Backend-optimized stop order · road geometry preview' : 'Road-following map preview'} · not live navigation</div>
    {notice && <button className="map-notice" onClick={() => setNotice('')}>{notice} ×</button>}
  </div>;
}
