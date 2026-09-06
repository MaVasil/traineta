// Google Maps Service Layer for TrainETA
// Isolates all Google Maps JavaScript API interaction and provides fallback mechanisms.

let googleMapsPromise = null;

export const mapService = {
  /**
   * Check if Google Maps is already available in the global window object
   */
  isLoaded() {
    return typeof window !== 'undefined' && !!(window.google && window.google.maps);
  },

  /**
   * Safely load the Google Maps JavaScript API script
   */
  async loadGoogleMaps() {
    if (this.isLoaded()) {
      return window.google.maps;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'your_google_maps_api_key' || apiKey.trim() === '') {
      return null;
    }

    if (googleMapsPromise) {
      return googleMapsPromise;
    }

    googleMapsPromise = new Promise((resolve) => {
      // Check if script tag already exists
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.google?.maps || null));
        existingScript.addEventListener('error', () => resolve(null));
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if (window.google?.maps) {
          resolve(window.google.maps);
        } else {
          resolve(null);
        }
      };

      script.onerror = () => {
        console.warn('Google Maps script failed to load. Falling back to built-in route visualizer.');
        resolve(null);
      };

      document.head.appendChild(script);
    });

    return googleMapsPromise;
  },

  /**
   * Railway Operations Dark Theme for Google Maps
   */
  getDarkStyles() {
    return [
      { elementType: 'geometry', stylers: [{ color: '#0B1220' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#0B1220' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
      {
        featureType: 'administrative.locality',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#F9FAFB' }],
      },
      {
        featureType: 'poi',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#64748B' }],
      },
      {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#1F2937' }],
      },
      {
        featureType: 'road',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#111827' }],
      },
      {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#374151' }],
      },
      {
        featureType: 'transit.line',
        elementType: 'geometry',
        stylers: [{ color: '#2563EB' }, { weight: 3 }],
      },
      {
        featureType: 'transit.station',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#93C5FD' }],
      },
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#080E1A' }],
      },
      {
        featureType: 'water',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#475569' }],
      },
    ];
  },

  /**
   * Railway Operations Light Theme for Google Maps
   */
  getLightStyles() {
    return [
      { elementType: 'geometry', stylers: [{ color: '#F8FAFC' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
      {
        featureType: 'transit.line',
        elementType: 'geometry',
        stylers: [{ color: '#2563EB' }, { weight: 3 }],
      },
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#E2E8F0' }],
      },
    ];
  },

  /**
   * Create SVG Marker for Trains (No emojis)
   */
  createTrainMarkerIcon(isDark = false) {
    if (!this.isLoaded()) return null;
    return {
      path: 'M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4s-8 .5-8 4v10.5zm8-12.5c4.78 0 6 1.05 6 2v2H6V5c0-.95 1.22-2 6-2zm-4.5 14c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-5H6V9h12v3z',
      fillColor: '#2563EB',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 2,
      scale: 1.3,
      anchor: new window.google.maps.Point(12, 12),
    };
  },

  /**
   * Create Station Marker Icon
   */
  createStationMarkerIcon(isPassed = false, isCurrent = false) {
    if (!this.isLoaded()) return null;
    let color = '#64748B';
    let scale = 6;
    if (isPassed) {
      color = '#16A34A';
      scale = 7;
    } else if (isCurrent) {
      color = '#2563EB';
      scale = 9;
    }

    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 2,
    };
  },
};
