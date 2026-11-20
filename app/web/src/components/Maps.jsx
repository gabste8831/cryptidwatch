import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router';
import { caseNumber } from '../lib/format.js';

// Tiles do OpenStreetMap tingidos de sépia via CSS (mapa de investigação).
// O domínio está liberado na CSP do Nginx (img-src).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const pin = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
// Círculo "feito à caneta" em volta do local, como numa investigação.
const circled = L.divIcon({ className: '', html: '<div class="pin-circle"></div>', iconSize: [54, 54], iconAnchor: [27, 27] });

/** Mapa pequeno do local do avistamento, como um recorte colado na ficha. */
export function RadarMap({ lat, lng }) {
  if (lat == null || lng == null) {
    return (
      <div className="mini-map">
        <div className="mini-map-empty">local exato não informado</div>
      </div>
    );
  }
  return (
    <div className="mini-map">
      <MapContainer center={[lat, lng]} zoom={11} zoomControl={false} dragging={false} scrollWheelZoom={false}
        doubleClickZoom={false} attributionControl={false} keyboard={false}>
        <TileLayer url={TILES} />
        <Marker position={[lat, lng]} icon={circled} />
      </MapContainer>
    </div>
  );
}

/** Mapa geral com um alfinete vermelho por caso verificado. */
export function CasesMap({ items }) {
  const pts = items.filter((s) => s.latitude != null && s.longitude != null);
  return (
    <div className="map-frame paper">
      <span className="tape tape-tl" aria-hidden="true" />
      <span className="tape tape-tr" aria-hidden="true" />
      <MapContainer center={[-14.5, -51]} zoom={4} scrollWheelZoom={false} minZoom={3}>
        <TileLayer url={TILES} attribution={ATTRIBUTION} />
        {pts.map((s) => (
          <Marker key={s.id} position={[s.latitude, s.longitude]} icon={pin}>
            <Popup>
              <div style={{ color: 'var(--blood)', fontSize: 13 }}>{caseNumber(s.id)}</div>
              <div className="case-title" style={{ fontSize: 17, margin: '4px 0' }}>{s.title}</div>
              <div style={{ fontSize: 13 }}>{s.cryptid.name} · {s.city}/{s.uf}</div>
              <Link to={`/casos/${s.id}`} className="btn btn-sm btn-primary" style={{ marginTop: 10 }}>Abrir dossiê</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
