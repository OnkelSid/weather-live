document.addEventListener('DOMContentLoaded', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            initializeWeather(lat, lon);
            reverseGeocode(lat, lon);
        }, showError);
    } else {
        alert("Geolocation is not supported by this browser.");
    }

    document.getElementById('search-button').addEventListener('click', () => {
        const city = document.getElementById('search-city').value;
        if (city) {
            getCoordinates(city);
        }
    });

    document.getElementById('predefined-cities').addEventListener('change', (event) => {
        const city = event.target.value;
        if (city) {
            getCoordinates(city);
        }
    });
});

function getCoordinates(city) {
    const url = `/.netlify/functions/fetchWeather?type=coordinates&query=${encodeURIComponent(city)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.status === "OK" && data.results.length > 0) {
                const { lat, lng } = data.results[0].geometry.location;
                initializeWeather(lat, lng);
                let formattedCity = formatCityName(data.results[0].formatted_address.split(',')[0]);
                formattedCity = translateToNorwegian(formattedCity);
                document.getElementById('location').textContent = formattedCity;
            } else {
                console.error('No location found for:', city);
                updateUIForNoData(city);  // Handle UI update for no data scenario
            }
        })
        .catch(error => console.error('Error fetching location coordinates:', error));
}

function updateUIForNoData(cityName) {
    document.getElementById('location').textContent = 'Unknown location';
    // Potentially clear other UI elements related to weather data here
    console.error('No data available for city:', cityName);
}

function formatCityName(cityName) {
    // Replaces common incorrect character mappings
    cityName = cityName.replace('Tromso', 'Tromsø').replace('Alesund', 'Ålesund');
    return cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();
}

function translateToNorwegian(text) {
    const translations = {
        "municipality": "kommune"
    };

    Object.keys(translations).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        text = text.replace(regex, translations[key]);
    });

    return text;
}

function reverseGeocode(lat, lon) {
    const url = `/.netlify/functions/fetchWeather?type=reverseGeocode&query=${lat},${lon}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log(data);  // Log the data to see what Google is returning
            if (data.status === "OK" && data.results.length > 0) {
                let cityInfo = data.results.find(result => 
                    result.types.includes('locality') || 
                    result.types.includes('sublocality') || 
                    result.types.includes('administrative_area_level_3') || 
                    result.types.includes('political')
                );

                let cityName;
                if (cityInfo) {
                    cityName = cityInfo.address_components.find(comp => 
                        comp.types.includes('locality') || 
                        comp.types.includes('sublocality') || 
                        comp.types.includes('administrative_area_level_3') || 
                        comp.types.includes('political')
                    );
                    cityName = cityName ? formatCityName(cityName.long_name) : formatCityName(cityInfo.formatted_address);
                    cityName = translateToNorwegian(cityName);
                } else {
                    cityName = 'Unknown location';
                }

                document.getElementById('location').textContent = cityName;
            } else {
                console.error('Unable to find the city name, API status:', data.status);
                document.getElementById('location').textContent = 'Unknown location'; // Fallback text
            }
        })
        .catch(error => {
            console.error('Error fetching city name:', error);
            document.getElementById('location').textContent = 'Error determining location';
        });
}

// iframe script
window.addEventListener('message', event => {
    if (event.origin !== 'your-parent-domain') return;

    const { lat, lon } = event.data;
    initializeWeather(lat, lon);
});

function initializeWeather(lat, lon) {
    getWeatherData(lat, lon);
    updateHourlyForecastCards(lat, lon);
    updateFourDayForecast(lat, lon);
    getSunriseSunset(lat, lon);
}

function displayWeather(data) {
    // Assuming this function is properly handling and displaying the weather data
    // Update the DOM elements with weather details
}

function getWeatherData(lat, lon) {
    const url = `/.netlify/functions/fetchWeather?type=weather&query=${lat},${lon}`;
    fetch(url, {
        headers: { 'User-Agent': 'BullsApp/0.1 preben@bulls.no' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.properties && data.properties.timeseries && data.properties.timeseries.length > 0) {
            const now = new Date();
            const closestForecast = data.properties.timeseries.reduce((closest, entry) => {
                const entryTime = new Date(entry.time);
                const closestTime = closest ? new Date(closest.time) : 0;
                return (!closest || Math.abs(entryTime - now) < Math.abs(closestTime - now)) ? entry : closest;
            }, null);

            if (!closestForecast) {
                console.error('Suitable forecast data is not available.');
                return;
            }

            const hour = now.getHours();
            const period = (hour >= 6 && hour < 18) ? 'next_1_hours' : 'next_1_hours';
            const details = closestForecast.data[period] ? closestForecast.data[period].summary.symbol_code : 'clearsky_day'; 
            const temperature = Math.round(closestForecast.data.instant.details.air_temperature);
            const windSpeed = Math.round(closestForecast.data.instant.details.wind_speed);
            const relativeHumidity = Math.round(closestForecast.data.instant.details.relative_humidity);
            const cloudAreaFraction = Math.round(closestForecast.data.instant.details.cloud_area_fraction);

            document.getElementById('temperature').textContent = `${temperature}°`;
            document.getElementById('weather-description').innerHTML = `<img src="img/${details}.png" class="weather-icon" alt="Weather Icon">`;
            document.getElementById('wind-speed').textContent = `${windSpeed} m/s`;
            document.getElementById('humidity').textContent = `${relativeHumidity}%`;
            document.getElementById('cloud-cover').textContent = `${cloudAreaFraction}%`;
        } else {
            console.error('Forecast data is missing');
            alert('Forecast data is missing for the provided location.');
        }
    })
    .catch(error => {
        console.error('Error fetching weather data:', error);
        alert('Failed to retrieve weather data.');
    });
}

function getSunriseSunset(lat, lon) {
    const times = SunCalc.getTimes(new Date(), lat, lon);
    const sunrise = times.sunrise;
    const sunset = times.sunset;

    // Check if the dates are valid or not (this handles the midnight sun and polar night cases)
    if (isNaN(sunrise.getTime()) || isNaN(sunset.getTime())) {
        // If the dates are invalid, it's likely due to polar night or midnight sun
        document.getElementById('sunrise-time').textContent = "Midnattssol";
        document.getElementById('sunset-time').textContent = "Midnattssol";
    } else {
        const formattedSunrise = sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const formattedSunset = sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        document.getElementById('sunrise-time').textContent = formattedSunrise;
        document.getElementById('sunset-time').textContent = formattedSunset;
    }
}

let forecastChart; // This will hold the chart instance

function updateHourlyForecastChart(data) {
    const labels = [];
    const temperatureData = [];
    const windSpeedData = [];

    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 3, 0, 0, 0); // Start 3 hours from now, rounding to the next full hour
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 24); // 24 hours from start time

    data.properties.timeseries.filter(forecast => {
        const forecastTime = new Date(forecast.time);
        return forecastTime >= startTime && forecastTime <= endTime && ((forecastTime.getHours() - startTime.getHours()) % 3 === 0);
    }).forEach(forecast => {
        const forecastTime = new Date(forecast.time);
        labels.push(forecastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        temperatureData.push(Math.round(forecast.data.instant.details.air_temperature));
        windSpeedData.push(Math.round(forecast.data.instant.details.wind_speed));
    });

    const ctx = document.getElementById('forecast-chart').getContext('2d');

    if (forecastChart) {
        forecastChart.data.labels = labels;
        forecastChart.data.datasets[0].data = temperatureData;
        forecastChart.data.datasets[1].data = windSpeedData;
        forecastChart.update();
    } else {
        forecastChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Temperatur (°C)',
                    data: temperatureData,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    yAxisID: 'y',
                }, {
                    label: 'Vind (m/s)',
                    data: windSpeedData,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    yAxisID: 'y1',
                }]
            },
            options: {
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false, // only draw grid for Y axis
                        }
                    }
                }
            }
        });
    }
}

// Add event listener to re-draw the chart when the window gains focus
window.addEventListener('focus', () => {
    if (forecastChart) {
        forecastChart.update();
    }
});

function updateHourlyForecastCards(lat, lon) {
    const url = `/.netlify/functions/fetchWeather?type=weather&query=${lat},${lon}`;
    fetch(url, {
        headers: { 'User-Agent': 'BullsApp/0.1 preben@bulls.no' }
    })
        .then(response => response.json())
        .then(data => {
            displayHourlyForecastCards(data); // Update cards
            updateHourlyForecastChart(data);  // Update chart, ensure this call is here
        })
        .catch(error => console.error('Error fetching hourly forecast data:', error));
}

function displayHourlyForecastCards(data) {
    const cardContainer = document.getElementById('hourly-forecast-cards');
    cardContainer.innerHTML = '';

    if (!data.properties.timeseries) {
        console.error('No timeseries data available.');
        return;
    }

    // Start from the same adjusted hour as the chart
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 3, 0, 0, 0); // Start 3 hours from now, rounding to the next full hour
    lastHourlyForecastEndTime = new Date(startTime);
    lastHourlyForecastEndTime.setHours(lastHourlyForecastEndTime.getHours() + 24); // 24 hours from start time

    const forecasts = data.properties.timeseries.filter(forecast => {
        const forecastTime = new Date(forecast.time);
        return forecastTime >= startTime && forecastTime <= lastHourlyForecastEndTime && ((forecastTime.getHours() - startTime.getHours()) % 3 === 0);
    }).slice(0, 8); // Limit to the next 8 valid entries for consistency

    forecasts.forEach(forecast => {
        const time = new Date(forecast.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const period = forecast.data.next_1_hours ? 'next_1_hours' : 'next_6_hours';
        const symbolCode = forecast.data[period].summary.symbol_code;
        const temperature = Math.round(forecast.data.instant.details.air_temperature);
        const windSpeedData = Math.round(forecast.data.instant.details.wind_speed);
        const precipitation = (forecast.data.next_6_hours?.details.precipitation_amount || forecast.data.next_1_hours?.details.precipitation_amount) || 0;

        const cardHTML = `
            <div class="col">
                <div class="card">
                    <div class="card-body">
                        <h4 class="card-title">${time}</h4>
                        <img src="img/${symbolCode}.png" class="weather-icon" id="icon-card" alt="Weather Icon">
                        <p class="card-text" id="temp-card">${temperature}°</p>
                        <div style="display: flex; justify-content: space-between;">
                            <p class="card-text"><i class="bi bi-cloud-drizzle"></i> ${Math.round(precipitation)} mm</p>
                            <p class="card-text" style="margin-left: 10px;"><i class="bi bi-wind"></i> ${windSpeedData} m/s</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        cardContainer.insertAdjacentHTML('beforeend', cardHTML);
    });

    // Update the global variable to reflect the end time of the last hourly forecast
    lastHourlyForecastEndTime = forecasts.length > 0 ? new Date(forecasts[forecasts.length - 1].time) : lastHourlyForecastEndTime;
}

function updateFourDayForecast(lat, lon) {
    const url = `/.netlify/functions/fetchWeather?type=weather&query=${lat},${lon}`;
    fetch(url, {
        headers: { 'User-Agent': 'BullsApp/0.1 preben@bulls.no' }
    })
        .then(response => response.json())
        .then(data => displayFourDayForecast(data))
        .catch(error => console.error('Error fetching four-day forecast data:', error));
}

function displayFourDayForecast(data) {
    const forecastBody = document.getElementById('daily-forecast-body');
    forecastBody.innerHTML = '';
    let dayData = {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeSlots = [
        { start: 0, end: 6 },
        { start: 6, end: 12 },
        { start: 12, end: 18 },
        { start: 18, end: 24 }
    ];

    data.properties.timeseries.forEach(forecast => {
        const forecastTime = new Date(forecast.time);
        if (forecastTime >= tomorrow) {
            const day = forecastTime.toLocaleDateString('no-NO', { weekday: 'long' });
            const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
            const hour = forecastTime.getHours();

            if (!dayData[capitalizedDay]) {
                dayData[capitalizedDay] = {};
                timeSlots.forEach(slot => {
                    dayData[capitalizedDay][`${slot.start}-${slot.end}`] = {
                        temperatures: [],
                        precipitation: 0,
                        symbolCode: 'default',
                        windSpeeds: []
                    };
                });
            }

            timeSlots.forEach(slot => {
                if (hour >= slot.start && hour < slot.end) {
                    const slotData = dayData[capitalizedDay][`${slot.start}-${slot.end}`];
                    const next6Hours = forecast.data.next_6_hours;
                    const instantDetails = forecast.data.instant.details;

                    if (next6Hours) {
                        slotData.symbolCode = next6Hours.summary.symbol_code || 'default';
                        slotData.precipitation += next6Hours.details.precipitation_amount || 0;
                    }

                    if (instantDetails.air_temperature !== undefined) {
                        slotData.temperatures.push(instantDetails.air_temperature);
                    }

                    if (instantDetails.wind_speed !== undefined) {
                        slotData.windSpeeds.push(instantDetails.wind_speed);
                    }
                }
            });
        }
    });

    Object.keys(dayData).forEach((day, index) => {
        const row = `
            <tr class="forecast-row" data-day="${day}">
                <td>${day}</td>
                ${timeSlots.map(slot => {
                    const slotKey = `${slot.start}-${slot.end}`;
                    const slotData = dayData[day][slotKey];
                    const avgTemp = slotData.temperatures.length ? (slotData.temperatures.reduce((a, b) => a + b, 0) / slotData.temperatures.length).toFixed(1) : 'N/A';
                    const avgWindSpeed = slotData.windSpeeds.length ? (slotData.windSpeeds.reduce((a, b) => a + b, 0) / slotData.windSpeeds.length).toFixed(1) : 'N/A';
                    const hideSlot = index === 0 && (new Date(tomorrow).setHours(slot.end) <= lastHourlyForecastEndTime.getTime());
                    return `<td class="${hideSlot ? 'hidden-slot' : ''}">
                        ${hideSlot ? '' : `
                            <div><img src="img/${slotData.symbolCode}.png" class="weather-icon" alt="Weather Icon"></div>
                            <div>${avgTemp}°</div>
                            <div style="display: none;" class="expanded-details">
                                <div>${avgWindSpeed} m/s</div>
                                <div>${slotData.precipitation.toFixed(1)} mm</div>
                            </div>
                        `}
                    </td>`;
                }).join('')}
            </tr>
        `;
        forecastBody.insertAdjacentHTML('beforeend', row);
    });

    // Attach event listeners after the forecast table is built
    attachRowClickListeners();
}

function attachRowClickListeners() {
    const rows = document.querySelectorAll('.forecast-row');
    rows.forEach(row => {
        row.removeEventListener('click', toggleDetails);
        row.addEventListener('click', toggleDetails);
    });
}

function toggleDetails(event) {
    const expandedDetails = event.currentTarget.querySelectorAll('.expanded-details');
    expandedDetails.forEach(detail => {
        detail.style.display = detail.style.display === 'none' || detail.style.display === '' ? 'block' : 'none';
    });
}

// Usage
updateHourlyForecastCards(59.91, 10.75); // Example coordinates for Oslo, Norway

function showError(error) {
    console.error('Geolocation error:', error.message);
    document.getElementById('location').textContent = 'Location access denied.';
}
