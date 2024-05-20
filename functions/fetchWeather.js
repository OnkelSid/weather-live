const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const { type, query } = event.queryStringParameters;

  let url = '';
  const googleApiKey = process.env.GOOGLE_API_KEY;

  if (type === 'coordinates') {
    url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleApiKey}&components=country:NO`;
  } else if (type === 'reverseGeocode') {
    const [lat, lon] = query.split(',');
    url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${googleApiKey}&language=no`;
  } else if (type === 'weather') {
    const [lat, lon] = query.split(',');
    url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid type parameter' }),
    };
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BullsApp/0.1 preben@bulls.no' }
    });
    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch data' }),
    };
  }
};
