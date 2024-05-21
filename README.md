# weather-live
Værmelding

iframe code:

<iframe id="weather-iframe" src="https://weather-live-no.netlify.app/" width="720" height="1400" allow="geolocation"></iframe>
<script>
    // Parent page script
    document.addEventListener('DOMContentLoaded', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const iframe = document.getElementById('weather-iframe');
          iframe.contentWindow.postMessage({ lat, lon }, '*');
        }, error => {
          console.error('Geolocation error:', error);
        });
      } else {
        alert("Geolocation is not supported by this browser.");
      }
    });
  </script>