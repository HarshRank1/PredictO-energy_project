import dynamic from 'next/dynamic';
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export default function Map() {
  return (
    <div className="w-full h-full">
      <h4 className="font-semibold mb-2">Building Map</h4>
      <Plot
        data={[
          {
            type: 'scattermapbox',
            lat: ['40.7128'],
            lon: ['-74.0060'],
            mode: 'markers',
            marker: { size: 14 },
            text: ['Sample Building'],
          },
        ]}
        layout={{
          autosize: true,
          height: 400,
          mapbox: {
            style: 'open-street-map',
            center: { lat: 40.7128, lon: -74.0060 },
            zoom: 10,
          },
          margin: { t: 30, r: 10, l: 40, b: 40 },
        }}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
