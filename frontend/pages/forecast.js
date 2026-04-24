import Head from 'next/head';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import DailyPredictions from '../components/DailyPredictions';



export default function Home() {
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState(null);
  const [area, setArea] = useState('');
  const [primaryUse, setPrimaryUse] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [forecastMonth, setForecastMonth] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [forecastData, setForecastData] = useState(null);
  const [showMap, setShowMap] = useState(false);
  
  const FlexibleMap = dynamic(() => import('../components/FlexibleMap'), { ssr: false });

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const forecastYearOptions = (() => {
    const curr = new Date().getFullYear();
    const out = [];
    for (let y = curr; y <= curr + 10; y++) out.push(y);
    return out;
  })();

  // Building type options mapping back to the primary keys backend expects
  const primaryUseOptions = ['Education','Entertainment/public assembly','Food sales and service','Healthcare','Lodging/residential','Manufacturing/industrial','Office','Other','Parking','Public services','Religious worship','Retail','Services','Technology/science','Utility','Warehouse/storage'];

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setStatusMsg('Geolocation not supported in this browser.');
      return;
    }
    setStatusMsg('Locating...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });
        setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setStatusMsg('Location captured');
      },
      (err) => {
        console.error('Geolocation error:', err);
        let msg = 'Unable to retrieve location: ' + (err && err.message ? err.message : 'unknown error');
        if (err && typeof err.code === 'number') {
          // 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
          if (err.code === 1) msg += ' (permission denied). Please allow location access in your browser.';
          else if (err.code === 2) msg += ' (position unavailable). Check your device or try again.';
          else if (err.code === 3) msg += ' (timed out). Try again or increase timeout.';
        }
        // Hint about secure context requirement
        try {
          if (typeof window !== 'undefined' && window.location && window.location.protocol !== 'https:' && !window.location.hostname.includes('localhost')) {
            msg += ' Note: Geolocation requires a secure context (HTTPS). Serve the app over HTTPS or use localhost.';
          }
        } catch (e) {
          // ignore
        }
        setStatusMsg(msg);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const geocodeLocation = async (address) => {
    if (!address) return null;
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await resp.json();
      if (data && data.length > 0) {
        return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Required fields validation
    if (!location || !area || !yearBuilt || !primaryUse || !forecastMonth) {
      setStatusMsg('Please complete all required fields.');
      return;
    }

    setStatusMsg('Geocoding location...');
    let currentCoords = coords;
    
    // If coords are empty (user manually typed location instead of using 'My location'), fetch them
    if (!currentCoords) {
      currentCoords = await geocodeLocation(location);
      if (!currentCoords) {
        setStatusMsg('Could not find coordinates for this location. Please try a more specific address.');
        return;
      }
      setCoords(currentCoords);
    }

    const payload = {
      location,
      coords: currentCoords,
      area: Number(area) || 0,
      primary_use: primaryUse,
      yearBuilt: Number(yearBuilt) || null,
      forecastMonth: forecastMonth,
    };

    setStatusMsg('Sending inputs to backend for forecasting...');
    fetch('http://localhost:8000/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'server error');
      }
      return res.json();
    }).then((data) => {
      console.log('Forecast response', data);
      if (data.results && data.results.length > 0 && data.results[0].error) {
         setStatusMsg('Forecast error: ' + data.results[0].error);
      } else {
         setStatusMsg('Forecast received. Chart updated below.');
      }
      setForecastData(data);
    }).catch((err) => {
      console.error('Forecast error', err);
      setStatusMsg('Forecast failed: ' + (err.message || err));
    });
  };
  return (
    <div className="home-root">
      <Head>
        <title>Energy Forecasting · Residential Buildings</title>
      </Head>

      <main className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '2rem 0', color: 'white' }}>Generate Forecast</h2>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <section className="input-section" id="inputs" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', paddingBottom: '2rem' }}>
            <div className="card card-large rounded-xl">
              <h3 className="text-lg font-semibold">Building Inputs</h3>
              <form onSubmit={handleSubmit} className="inputs-form">
                <label className="field-label">Location</label>
                <div className="input-row">
                  <input type="text" value={location} onChange={(e) => {setLocation(e.target.value); setCoords(null);}} placeholder="Enter City, Address, or Region" className="input input-grow" required />
                  <button type="button" onClick={useMyLocation} className="btn btn-primary">Locate Me</button>
                  <button type="button" onClick={() => setShowMap(!showMap)} className="btn btn-outline">{showMap ? 'Hide Map' : 'Show Map'}</button>
                </div>
                {showMap && (
                  <div style={{ height: '300px', width: '100%', marginTop: '10px', borderRadius: '8px', overflow: 'hidden' }}>
                    <FlexibleMap 
                      onLocationSelect={(latlng) => {
                        setCoords({ latitude: latlng.lat, longitude: latlng.lng });
                        setLocation(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
                        setShowMap(false);
                      }} 
                    />
                  </div>
                )}
                {coords && !showMap && (
                  <div className="text-xs muted mt-2">Resolved Coordinates: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</div>
                )}

                <label className="field-label">Area (sq.ft) *</label>
                <input type="number" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. 1200" className="input" min="1" required />

                <label className="field-label">Building Type *</label>
                <select value={primaryUse} onChange={(e) => setPrimaryUse(e.target.value)} className="input" required>
                  <option value="">Select Primary Use</option>
                  {primaryUseOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>

                <div className="mt-3">
                  <label className="field-label">Year Built *</label>
                  <input type="number" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} placeholder="e.g. 1998" className="input" required />
                </div>

                <label className="field-label">Target Forecast Month *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    value={forecastMonth.split(' ')[0] || ''} 
                    onChange={(e) => setForecastMonth(`${e.target.value} ${forecastMonth.split(' ')[1] || new Date().getFullYear()}`)} 
                    className="input" 
                    required
                  >
                    <option value="">Select Month</option>
                    {monthNames.map(m => <option key={`fm-${m}`} value={m}>{m}</option>)}
                  </select>
                  <select 
                    value={forecastMonth.split(' ')[1] || new Date().getFullYear()} 
                    onChange={(e) => setForecastMonth(`${forecastMonth.split(' ')[0] || monthNames[0]} ${e.target.value}`)} 
                    className="input" 
                    required
                  >
                    <option value="">Select Year</option>
                    {forecastYearOptions.map(y => <option key={`fy-${y}`} value={y}>{y}</option>)}
                  </select>
                </div>

                <div className="form-row">
                  <div className="text-xs muted">{statusMsg}</div>
                  <div className="button-row">
                    <button type="submit" className="btn btn-success">Get Live Forecast</button>
                    <button type="button" onClick={() => { setLocation(''); setCoords(null); setArea(''); setYearBuilt(''); setPrimaryUse(''); setForecastMonth(''); setStatusMsg(''); setForecastData(null); }} className="btn btn-outline">Clear</button>
                  </div>
                </div>
              </form>
            </div>
          </section>

          {forecastData && (
            <section className="results-section" style={{ width: '100%', maxWidth: '1000px', margin: '2rem auto' }}>
              <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                <div className="card card-small text-center" style={{padding: '12px'}}>
                  <div className="text-sm muted">Model Scope</div>
                  <div className="font-semibold text-md mt-1">1 Month</div>
                </div>
                <div className="card card-small text-center" style={{padding: '12px'}}>
                  <div className="text-sm muted">Avg Air Temp</div>
                  <div className="font-semibold text-md mt-1">{forecastData.avg_air_temp != null ? `${forecastData.avg_air_temp.toFixed(1)}°C` : '--'}</div>
                </div>
                <div className="card card-small text-center" style={{padding: '12px'}}>
                  <div className="text-sm muted">Avg Dew Point</div>
                  <div className="font-semibold text-md mt-1">{forecastData.avg_dew_temp != null ? `${forecastData.avg_dew_temp.toFixed(1)}°C` : '--'}</div>
                </div>
                <div className="card card-small text-center" style={{padding: '12px'}}>
                  <div className="text-sm muted">Target Month</div>
                  <div className="font-semibold text-md mt-1">{forecastMonth || '--'}</div>
                </div>
              </div>

              <div className="mt-6 card card-large rounded-xl">
                <h4 className="text-lg font-semibold">Prediction Chart</h4>
                <div className="mt-3 muted">Hourly and daily aggregations of the AI prediction model.</div>
                <div className="mt-4">
                  <DailyPredictions data={forecastData} />
                </div>
              </div>
            </section>
          )}
        </div>

        <footer className="site-footer">
          <div className="footer-inner muted">© {new Date().getFullYear()} Energy Forecasting — built for research & operations.</div>
        </footer>
      </main>
    </div>
  );
}
