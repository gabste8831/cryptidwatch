import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router';
import { caseNumber } from '../lib/format.js';

// Tiles do OpenStreetMap (escurecidos via CSS). O domínio está liberado na CSP do Nginx (img-src).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const blip = (pulse) => L.divIcon({
  className: '',
  html: `<div class="blip${pulse ? ' blip-pulse' : ''}"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Minimapa redondo com varredura de radar. */
export function RadarMap({ lat, lng }) {
  if (lat == null || lng == null) {
    return (
      <div className="radar">
        <div className="radar-empty"><span className="hud">Sem coordenadas<br />no relato</span></div>
      </div>
    );
  }
  return (
    <div className="radar">
      <MapContainer center={[lat, lng]} zoom={11} zoomControl={false} dragging={false} scrollWheelZoom={false}
        doubleClickZoom={false} attributionControl={false} keyboard={false}>
        <TileLayer url={TILES} />
        <Marker position={[lat, lng]} icon={blip(true)} />
      </MapContainer>
    </div>
  );
}

/** Mapa geral com um ponto por caso aprovado que tenha coordenadas. */
export function CasesMap({ items }) {
  const pts = items.filter((s) => s.latitude != null && s.longitude != null);
  return (
    <div className="map-frame">
      <MapContainer center={[-14.5, -51]} zoom={4} scrollWheelZoom={false} minZoom={3}>
        <TileLayer url={TILES} attribution={ATTRIBUTION} />
        {pts.map((s) => (
          <Marker key={s.id} position={[s.latitude, s.longitude]} icon={blip(false)}>
            <Popup>
              <div className="mono" style={{ color: 'var(--sun-2)' }}>{caseNumber(s.id)}</div>
              <div className="case-title" style={{ fontSize: 18, margin: '4px 0' }}>{s.title}</div>
              <div className="hud dim">{s.cryptid.name} · {s.city}/{s.uf}</div>
              <Link to={`/casos/${s.id}`} className="btn btn-sm" style={{ marginTop: 10 }}>Abrir dossiê</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
