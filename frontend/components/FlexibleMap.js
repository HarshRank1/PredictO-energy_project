import { MapContainer, TileLayer, Marker, Popup, ZoomControl, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useRef } from 'react';
import styles from './FlexibleMap.module.css';

export default function FlexibleMapComponent() {
  const mapRef = useRef();
  const { BaseLayer } = LayersControl;

  return (
    <div className={styles.mapContainer}>
      {/* Search bar (demo only) */}
      <input
        type="text"
        placeholder="Search location... (feature demo)"
        className={styles.searchBar}
      />

      <MapContainer
        center={[40.7128, -74.006]}
        zoom={10}
        scrollWheelZoom={true}
        style={{ height: '400px', width: '100%' }}
        zoomControl={false}
        ref={mapRef}
      >
        <ZoomControl position="topright" />
        <LayersControl position="topright">
          <BaseLayer checked name="OpenStreetMap">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </BaseLayer>
          <BaseLayer name="Satellite">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          </BaseLayer>
        </LayersControl>

        <Marker position={[40.7128, -74.006]}>
          <Popup>Sample Building (New York)</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}