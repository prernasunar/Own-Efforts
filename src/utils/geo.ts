/**
 * Geolocation capture and reverse geocoding utility
 */

export interface GeoLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  formattedAddress: string;
}

export async function captureCurrentLocation(): Promise<GeoLocationResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 5000,
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        let formattedAddress = `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;

        try {
          // Attempt reverse geocoding via OpenStreetMap Nominatim
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en',
              },
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data && data.display_name) {
              const road = data.address?.road || data.address?.suburb || data.address?.neighbourhood || '';
              const city = data.address?.city || data.address?.town || data.address?.county || '';
              const landmark = road && city ? `${road}, ${city}` : data.display_name.split(',').slice(0, 3).join(',');
              formattedAddress = `${landmark} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
            }
          }
        } catch {
          // Fallback to coords if offline or reverse geocoding fails
          formattedAddress = `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`;
        }

        resolve({
          latitude,
          longitude,
          accuracy,
          formattedAddress,
        });
      },
      (error) => {
        let message = 'Unable to retrieve your location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please allow GPS or enter location manually.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is currently unavailable.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
        }
        reject(new Error(message));
      },
      options
    );
  });
}
