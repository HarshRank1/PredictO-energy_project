import Head from 'next/head';
import Link from 'next/link';
import Carousel from '../components/Carousel';

export default function Home() {
  return (
    <div className="home-root">
      <Head>
        <title>Energy Forecasting · Intelligent Predictions</title>
        <meta name="description" content="AI-driven energy forecasts for residential and commercial buildings." />
      </Head>

      <main className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Main Hero Section */}
        <section className="site-hero" style={{ textAlign: 'center', padding: '1rem', display: 'block', marginTop: '-1rem' }}>
          <h1 className="hero-title" style={{ fontSize: 'clamp(1.5rem, 4.5vw, 3rem)', whiteSpace: 'nowrap', marginBottom: '1rem' }}>
            Smart Energy Forecasts <span className="badge-gradient">For Any Building</span>
          </h1>
        </section>

        {/* Carousel Component */}
        <Carousel />

        <div className="hero-actions" style={{ justifyContent: 'center', marginBottom: '2rem', marginTop: '0.5rem' }}>
          <Link href="/forecast" className="btn btn-gradient" style={{ padding: '1.5rem 4rem', fontSize: '1.5rem', borderRadius: '50px', color: 'white' }}>
            Forecast Yours
          </Link>
        </div>

      </main>

      <footer className="site-footer" style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', width: '100%' }}>
        <div className="footer-inner muted" style={{ textAlign: 'center' }}>
          © {new Date().getFullYear()} Energy Forecasting — Built for research & operations.
        </div>
      </footer>
    </div>
  );
}
