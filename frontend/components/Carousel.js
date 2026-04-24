import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './Carousel.module.css';

const buildingTypes = [
  { name: 'Education', icon: '🎓', desc: 'Schools, colleges, and university campuses' },
  { name: 'Office', icon: '🏢', desc: 'Commercial workspaces and corporate parks' },
  { name: 'Healthcare', icon: '🏥', desc: 'Hospitals, clinics, and medical centers' },
  { name: 'Retail', icon: '🛍️', desc: 'Malls, supermarkets, and stores' },
  { name: 'Lodging/residential', icon: '🏨', desc: 'Hotels, dormitories, and apartments' },
  { name: 'Manufacturing/industrial', icon: '🏭', desc: 'Factories and industrial plants' },
  { name: 'Warehouse/storage', icon: '📦', desc: 'Distribution centers and storage facilities' },
  { name: 'Food sales and service', icon: '🍽️', desc: 'Restaurants, cafes, and cafeterias' },
  { name: 'Entertainment/public assembly', icon: '🎭', desc: 'Theaters, stadiums, and arenas' },
  { name: 'Public services', icon: '🏛️', desc: 'Libraries, post offices, and government buildings' },
  { name: 'Religious worship', icon: '⛪', desc: 'Churches, mosques, and temples' },
  { name: 'Technology/science', icon: '🔬', desc: 'Laboratories and data centers' },
  { name: 'Utility', icon: '⚡', desc: 'Power plants and water treatment facilities' },
  { name: 'Parking', icon: '🅿️', desc: 'Garages and parking structures' },
  { name: 'Services', icon: '✂️', desc: 'Salons, dry cleaners, and repair shops' }
];

export default function Carousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-scroll every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % buildingTypes.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + buildingTypes.length) % buildingTypes.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % buildingTypes.length);
  };

  return (
    <div className={styles.carouselContainer}>
      <h2 className={styles.title}>Supported Building Types</h2>
      <div className={styles.carouselWrapper}>
        <button className={styles.navButton} onClick={handlePrev} aria-label="Previous">
          &#10094;
        </button>
        
        <div className={styles.viewport}>
          <div 
            className={styles.track} 
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {buildingTypes.map((type, idx) => (
              <div key={idx} className={styles.slide}>
                <Link href="/forecast" style={{ textDecoration: 'none' }}>
                  <div className={styles.card}>
                    {type.image ? (
                      <img src={type.image} alt={type.name} className={styles.cardImage} />
                    ) : (
                      <div className={styles.imagePlaceholder}>
                        <div className={styles.icon}>{type.icon}</div>
                      </div>
                    )}
                    <div className={styles.contentWrapper}>
                      <h3 className={styles.cardTitle}>{type.name}</h3>
                      <p className={styles.cardDesc}>{type.desc}</p>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        <button className={styles.navButton} onClick={handleNext} aria-label="Next">
          &#10095;
        </button>
      </div>
      <div className={styles.indicators}>
        {buildingTypes.map((_, idx) => (
          <span 
            key={idx} 
            className={`${styles.dot} ${idx === currentIndex ? styles.activeDot : ''}`}
            onClick={() => setCurrentIndex(idx)}
          />
        ))}
      </div>
    </div>
  );
}
