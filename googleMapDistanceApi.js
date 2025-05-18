// Google Maps Distance Calculator
// This application uses the Google Maps API to calculate distances between locations
// and display routes on a map.

// Global variables
var map;
var directionsService;
var directionsRenderer;
var originautocomplete;
var destinationautocomplete;
var markers = [];
var waypointAutocompletes = []; // Array to store waypoint autocomplete objects
var waypointCount = 0; // Counter for waypoints

// Initialize the map and autocomplete functionality
function initAutocomplete() {
  console.log("Initializing map...");

  // Show loading message while map initializes
  document.getElementById('map').innerHTML = '<div class="map-loading">Loading map...</div>';

  try {
    // Initialize the map with user-friendly controls - center on Sri Lanka by default
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: 7.8731, lng: 80.7718 }, // Center on Sri Lanka
      zoom: 8,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_RIGHT
      },
      // Add user-friendly controls
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      },
      streetViewControl: true,
      streetViewControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      },
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: google.maps.ControlPosition.RIGHT_TOP
      }
    });

    console.log("Map initialized");

    // Add a welcome message to the map
    var welcomeInfoWindow = new google.maps.InfoWindow({
      content: '<div class="info-window"><h3>Welcome to the Distance Calculator</h3>' +
               '<p>Enter origin and destination addresses to calculate the distance and view the route.</p></div>',
      position: map.getCenter()
    });
    welcomeInfoWindow.open(map);

    // Close the welcome message after 8 seconds
    setTimeout(function() {
      welcomeInfoWindow.close();
    }, 8000);

    // Initialize the directions service and renderer with improved styling
    directionsService = new google.maps.DirectionsService();

    // Create the renderer without setting the map yet
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true, // We'll add custom markers
      polylineOptions: {
        strokeColor: '#4285F4',
        strokeWeight: 6,
        strokeOpacity: 0.9
      },
      // Improve the directions panel styling
      panel: null, // We're not using the directions panel
      hideRouteList: true,
      draggable: true, // Allow users to drag the route
      preserveViewport: false // Allow the map to zoom to fit the route
    });

    // Explicitly set the map for the renderer
    directionsRenderer.setMap(map);

    // Add a listener for when directions are set
    google.maps.event.addListener(directionsRenderer, 'directions_changed', function() {
      console.log("Directions changed");
    });

    // Create the autocomplete objects with improved options
    originautocomplete = new google.maps.places.Autocomplete(
      document.getElementById('originautocomplete'), {
        types: ['geocode'],
        fields: ['place_id', 'geometry', 'name', 'formatted_address']
      });

    // Remove country restriction to make it more flexible
    // Users can search for any location worldwide

    destinationautocomplete = new google.maps.places.Autocomplete(
      document.getElementById('destinationautocomplete'), {
        types: ['geocode'],
        fields: ['place_id', 'geometry', 'name', 'formatted_address']
      });

    // Add place_changed listeners with improved feedback
    originautocomplete.addListener('place_changed', function() {
      var place = originautocomplete.getPlace();
      if (place.geometry) {
        // If we have destination too, update the map
        if (document.getElementById('destinationautocomplete').value) {
          updateMap();
        } else {
          // Just center on the origin location
          map.setCenter(place.geometry.location);
          map.setZoom(13);
          // Add a marker for the origin
          addMarker(place.geometry.location, 'Origin', {
            url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
          });
        }
      }
    });

    destinationautocomplete.addListener('place_changed', function() {
      var place = destinationautocomplete.getPlace();
      if (place.geometry) {
        // If we have origin too, update the map
        if (document.getElementById('originautocomplete').value) {
          updateMap();
        } else {
          // Just center on the destination location
          map.setCenter(place.geometry.location);
          map.setZoom(13);
          // Add a marker for the destination
          addMarker(place.geometry.location, 'Destination', {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
          });
        }
      }
    });

    // Try to get user location once at startup, but don't force it
    // This will only prompt for location once when the page loads
    setTimeout(function() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function(position) {
            userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            };

            // Center map on user location
            map.setCenter(new google.maps.LatLng(userLocation.lat, userLocation.lng));
            map.setZoom(10);

            // Add a "You are here" marker
            var userMarker = new google.maps.Marker({
              position: new google.maps.LatLng(userLocation.lat, userLocation.lng),
              map: map,
              title: 'Your Location',
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#4285F4',
                fillOpacity: 0.7,
                strokeColor: 'white',
                strokeWeight: 2
              },
              animation: google.maps.Animation.DROP
            });

            // Add info window to user marker
            var infoWindow = new google.maps.InfoWindow({
              content: '<div class="info-window"><strong>Your Location</strong></div>'
            });

            userMarker.addListener('click', function() {
              infoWindow.open(map, userMarker);
            });

            // Briefly open the info window then close it
            infoWindow.open(map, userMarker);
            setTimeout(function() { infoWindow.close(); }, 3000);
          },
          function(error) {
            console.log("Initial geolocation error:", error.message);
            // No need to show an error - just use default location
          },
          {
            maximumAge: 600000,
            timeout: 5000,
            enableHighAccuracy: false
          }
        );
      }
    }, 1000);

  } catch (error) {
    console.error("Error initializing map:", error);
    document.getElementById('map').innerHTML =
      '<div class="map-error">Error loading map. Please refresh the page to try again.</div>';
  }
}

// Store whether we've already requested geolocation
var geolocationRequested = false;
var userLocation = null;

// Bias the autocomplete object to the user's geographical location
function geolocate(type) {
  // If we already have the user's location, use it without requesting again
  if (userLocation) {
    setBoundsForAutocomplete(type, userLocation);
    return;
  }

  // Only request geolocation once to avoid multiple popups
  if (!geolocationRequested && navigator.geolocation) {
    geolocationRequested = true;

    navigator.geolocation.getCurrentPosition(
      // Success callback
      function(position) {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };

        // Set bounds for the current autocomplete field
        setBoundsForAutocomplete(type, userLocation);

        // Also update the map to center on user's location
        if (map) {
          map.setCenter(new google.maps.LatLng(userLocation.lat, userLocation.lng));
          map.setZoom(10);
        }
      },
      // Error callback
      function(error) {
        console.log("Geolocation error:", error.message);
        // Use default location (Australia) if geolocation fails
        userLocation = { lat: -25.2744, lng: 133.7751, accuracy: 1000000 };
      },
      // Options
      {
        maximumAge: 600000,        // Use cached position if less than 10 minutes old
        timeout: 5000,             // Wait only 5 seconds for location
        enableHighAccuracy: false  // Don't need high accuracy, approximate is fine
      }
    );
  }
}

// Helper function to set bounds for autocomplete
function setBoundsForAutocomplete(type, location) {
  var circle = new google.maps.Circle({
    center: { lat: location.lat, lng: location.lng },
    radius: location.accuracy
  });

  // Set bounds based on which autocomplete is being used
  if (type === 'origin') {
    originautocomplete.setBounds(circle.getBounds());
  } else if (type === 'destination') {
    destinationautocomplete.setBounds(circle.getBounds());
  }
}

// Update the map with markers and route when inputs change
function updateMap() {
  // Clear existing markers
  clearMarkers();

  var origin = document.getElementById('originautocomplete').value;
  var destination = document.getElementById('destinationautocomplete').value;

  // Only proceed if both origin and destination are provided
  if (origin && destination) {
    displayRoute(origin, destination);
  }
}

// Clear all markers from the map
function clearMarkers() {
  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
  markers = [];
}

// Add a marker to the map
function addMarker(position, title, icon) {
  var marker = new google.maps.Marker({
    position: position,
    map: map,
    title: title,
    icon: icon
  });
  markers.push(marker);
  return marker;
}

// Display the route on the map
function displayRoute(origin, destination) {
  console.log("Displaying route from", origin, "to", destination);

  // Make sure the map is visible and properly sized
  var mapDiv = document.getElementById('map');
  mapDiv.style.height = '400px';
  mapDiv.style.width = '100%';
  mapDiv.style.display = 'block';

  // Ensure the page scrolls to show the map
  setTimeout(function() {
    mapDiv.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }, 500);

  // Force a resize event to ensure the map renders properly
  if (map) {
    google.maps.event.trigger(map, 'resize');
  }

  // Clear any existing markers
  clearMarkers();

  // Ensure the directions renderer is attached to our map
  if (directionsRenderer) {
    directionsRenderer.setMap(map);
  } else {
    console.error("Directions renderer not initialized");
    return;
  }

  // Create the route request
  var request = {
    origin: origin,
    destination: destination,
    travelMode: google.maps.TravelMode.DRIVING,
    provideRouteAlternatives: true,
    unitSystem: google.maps.UnitSystem.METRIC,
    optimizeWaypoints: true
  };

  // Request the route
  directionsService.route(request, function(response, status) {
    console.log("Route response status:", status);

    if (status === google.maps.DirectionsStatus.OK) {
      // Set the directions on the renderer
      directionsRenderer.setDirections(response);

      console.log("Route set on map, routes:", response.routes.length);

      if (response.routes.length > 0) {
        // Get the locations for markers
        var originLocation = response.routes[0].legs[0].start_location;
        var destinationLocation = response.routes[0].legs[0].end_location;

        // Add custom markers
        var originMarker = addMarker(originLocation, 'Origin', {
          url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
        });

        var destinationMarker = addMarker(destinationLocation, 'Destination', {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
        });

        // Add info windows to markers
        var originInfo = new google.maps.InfoWindow({
          content: '<div class="info-window"><strong>Origin:</strong> ' + origin + '</div>'
        });

        var destInfo = new google.maps.InfoWindow({
          content: '<div class="info-window"><strong>Destination:</strong> ' + destination + '</div>'
        });

        // Add click listeners to markers
        google.maps.event.addListener(originMarker, 'click', function() {
          originInfo.open(map, originMarker);
        });

        google.maps.event.addListener(destinationMarker, 'click', function() {
          destInfo.open(map, destinationMarker);
        });

        // Fit the map to show the entire route with padding
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(originLocation);
        bounds.extend(destinationLocation);

        // Add route waypoints to bounds
        var path = response.routes[0].overview_path;
        for (var i = 0; i < path.length; i++) {
          bounds.extend(path[i]);
        }

        map.fitBounds(bounds);

        // Add a small padding and limit zoom
        google.maps.event.addListenerOnce(map, 'idle', function() {
          if (map.getZoom() > 15) map.setZoom(15);
          map.panBy(0, -50);
        });

        console.log("Map bounds set to show route");
      }
    } else {
      console.error('Directions request failed due to ' + status);
      alert('Could not display route. Please try again with valid addresses.');

      // Center map on Sri Lanka as fallback
      map.setCenter({ lat: 7.8731, lng: 80.7718 });
      map.setZoom(8);
    }
  });
}

// Calculate and display the recommended route distance
function CalculatedRecommededDistance() {
  // First update the map
  updateMap();

  // Ensure the map is visible by scrolling to it
  setTimeout(function() {
    document.getElementById('map').scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }, 500);

  var origin = document.getElementById('originautocomplete').value;
  var destination = document.getElementById('destinationautocomplete').value;

  if (!origin || !destination) {
    alert('Please enter both origin and destination addresses');
    return;
  }

  // Calculate distances for all alternative routes
  CalculateDistanceforAllAlternativeRoutes();

  // Use Distance Matrix API to get the recommended route info
  var service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins: [origin],
    destinations: [destination],
    travelMode: 'DRIVING',
    unitSystem: google.maps.UnitSystem.METRIC,
    avoidHighways: false,
    avoidTolls: false,
    avoidFerries: false
  }, function(response, status) {
    if (status === google.maps.DistanceMatrixStatus.OK) {
      var originList = response.originAddresses;
      var destinationList = response.destinationAddresses;
      var outputDiv = document.getElementById('outputRecommended');
      outputDiv.innerHTML = '';

      // Display recommended route distance and duration
      for (var i = 0; i < originList.length; i++) {
        var results = response.rows[i].elements;
        for (var j = 0; j < results.length; j++) {
          outputDiv.innerHTML += originList[i] + ' to ' + destinationList[j] +
            ': ' + results[j].distance.text + ' in ' +
            results[j].duration.text + '<br>';
        }
      }
    } else {
      console.error('Distance Matrix request failed due to ' + status);
    }
  });
}

// Calculate distances for all alternative routes and display the longest one
function CalculateDistanceforAllAlternativeRoutes() {
  var start = document.getElementById('originautocomplete').value;
  var end = document.getElementById('destinationautocomplete').value;

  if (!start || !end) {
    return;
  }

  var request = {
    origin: start,
    destination: end,
    travelMode: google.maps.TravelMode.DRIVING,
    provideRouteAlternatives: true,
    unitSystem: google.maps.UnitSystem.METRIC,
    optimizeWaypoints: true
  };

  directionsService.route(request, function(response, status) {
    if (status === google.maps.DirectionsStatus.OK) {
      var routes = response.routes;
      var distances = [];
      var routeDetails = [];

      console.log("Found " + routes.length + " alternative routes");

      // Calculate distance for each alternative route
      for (var i = 0; i < routes.length; i++) {
        var distance = 0;
        var duration = 0;

        for (var j = 0; j < routes[i].legs.length; j++) {
          distance = parseInt(routes[i].legs[j].distance.value) + parseInt(distance);
          duration = parseInt(routes[i].legs[j].duration.value) + parseInt(duration);
        }

        // Convert to kilometers and minutes
        var distanceKm = distance / 1000;
        var durationMin = Math.round(duration / 60);

        distances.push(distanceKm);
        routeDetails.push({
          index: i,
          distance: distanceKm,
          duration: durationMin,
          route: routes[i]
        });
      }

      // Sort route details by distance (descending)
      routeDetails.sort(function(a, b) {
        return b.distance - a.distance;
      });

      // Get the longest route
      var longestRoute = routeDetails[0];

      // Display the longest route distance
      var outputDiv = document.getElementById('output');
      if (routes.length > 0) {
        // Format the distance with 1 decimal place
        var formattedDistance = Math.round(longestRoute.distance);
        outputDiv.innerHTML = formattedDistance + " KM";

        // Highlight the longest route on the map
        highlightLongestRoute(longestRoute.route);
      } else {
        outputDiv.innerHTML = "No routes found";
      }
    } else {
      console.error('Directions request failed due to ' + status);
      var outputDiv = document.getElementById('output');
      outputDiv.innerHTML = "Error: Could not calculate route. Please try again.";
    }
  });
}

// Function to highlight the longest route on the map
function highlightLongestRoute(route) {
  // Create a new renderer just for the longest route
  var longestRouteRenderer = new google.maps.DirectionsRenderer({
    map: map,
    directions: null,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#FF5722', // Orange color for longest route
      strokeWeight: 6,
      strokeOpacity: 0.8
    },
    preserveViewport: true
  });

  // Create a new DirectionsResult object with just the longest route
  var result = {
    routes: [route],
    request: route.request
  };

  // Set the directions on the renderer
  longestRouteRenderer.setDirections(result);

  // Add an info window to explain the route
  var infoWindow = new google.maps.InfoWindow({
    content: '<div class="info-window"><strong>Longest Alternative Route</strong><br>' +
             Math.round(route.legs[0].distance.value / 1000) + ' km, ' +
             Math.round(route.legs[0].duration.value / 60) + ' mins</div>'
  });

  // Add a marker at the midpoint of the route
  var path = route.overview_path;
  var midPoint = path[Math.floor(path.length / 2)];

  var marker = new google.maps.Marker({
    position: midPoint,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: '#FF5722',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2
    },
    title: 'Longest Alternative Route'
  });

  // Open info window when marker is clicked
  marker.addListener('click', function() {
    infoWindow.open(map, marker);
  });

  // Store the marker for later removal
  markers.push(marker);
}

// Function to use current location as origin
function useCurrentLocation() {
  if (navigator.geolocation) {
    // Show loading indicator
    document.getElementById('originautocomplete').value = "Getting your location...";

    navigator.geolocation.getCurrentPosition(
      function(position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;

        // Use reverse geocoding to get the address
        var geocoder = new google.maps.Geocoder();
        var latlng = {lat: lat, lng: lng};

        geocoder.geocode({'location': latlng}, function(results, status) {
          if (status === 'OK') {
            if (results[0]) {
              // Set the address in the input field
              document.getElementById('originautocomplete').value = results[0].formatted_address;

              // Center map on user location
              map.setCenter(latlng);
              map.setZoom(13);

              // Add a marker for the user's location
              addMarker(latlng, 'Your Location', {
                url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
              });

              // Store user location for later use
              userLocation = {
                lat: lat,
                lng: lng,
                accuracy: position.coords.accuracy
              };
            } else {
              alert('No address found for your location');
              document.getElementById('originautocomplete').value = "";
            }
          } else {
            alert('Could not get your address: ' + status);
            document.getElementById('originautocomplete').value = "";
          }
        });
      },
      function(error) {
        // Handle errors
        var errorMessage;
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location services.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
          default:
            errorMessage = "An unknown error occurred.";
        }
        alert(errorMessage);
        document.getElementById('originautocomplete').value = "";
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    alert("Geolocation is not supported by this browser.");
  }
}

// Add a waypoint input field
function addWaypoint() {
  // If this is the first waypoint, move destination to first waypoint
  if (waypointCount === 0) {
    var destValue = document.getElementById('destinationautocomplete').value;

    // Only proceed if destination has a value
    if (destValue.trim() === '') {
      alert('Please enter a destination before adding stops');
      return;
    }

    // Create the first waypoint with the current destination value
    createWaypoint(destValue);

    // Clear the destination field for the final destination
    document.getElementById('destinationautocomplete').value = '';
    document.getElementById('destinationautocomplete').placeholder = 'Enter final destination';
  } else {
    // For subsequent waypoints, just create a new empty waypoint
    createWaypoint('');
  }
}

// Helper function to create a waypoint
function createWaypoint(initialValue) {
  waypointCount++;

  // Create a new waypoint field
  var waypointContainer = document.getElementById('waypoints-container');
  var waypointField = document.createElement('div');
  waypointField.className = 'waypoint-field';
  waypointField.id = 'waypoint-field-' + waypointCount;

  // Create the waypoint icon
  var waypointIcon = document.createElement('i');
  waypointIcon.className = 'fas fa-map-pin waypoint-icon';

  // Create the waypoint number badge
  var waypointNumber = document.createElement('span');
  waypointNumber.className = 'waypoint-number';
  waypointNumber.textContent = waypointCount;

  // Create the input field
  var waypointInput = document.createElement('input');
  waypointInput.type = 'text';
  waypointInput.id = 'waypoint-' + waypointCount;
  waypointInput.className = 'waypoint-input';
  waypointInput.placeholder = 'Enter stop ' + waypointCount;
  waypointInput.value = initialValue;

  // Add elements to the waypoint field
  waypointField.appendChild(waypointIcon);
  waypointField.appendChild(waypointInput);

  // Add the waypoint field to the container
  waypointContainer.appendChild(waypointField);

  // Initialize autocomplete for the new waypoint
  var autocomplete = new google.maps.places.Autocomplete(waypointInput, {
    types: ['geocode'],
    fields: ['place_id', 'geometry', 'name', 'formatted_address']
  });

  // Store the autocomplete object
  waypointAutocompletes.push({
    id: waypointCount,
    autocomplete: autocomplete
  });

  // Add place_changed listener
  autocomplete.addListener('place_changed', function() {
    var place = autocomplete.getPlace();
    if (place.geometry) {
      // Center on the waypoint location
      map.setCenter(place.geometry.location);
      map.setZoom(13);

      // Add a marker for the waypoint
      addMarker(place.geometry.location, 'Stop ' + waypointCount, {
        url: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
      });
    }
  });

  // Show the remove waypoint button
  document.getElementById('remove-waypoint').style.display = 'flex';
}

// Remove the last waypoint
function removeWaypoint() {
  if (waypointCount > 0) {
    // Remove the last waypoint field
    var waypointContainer = document.getElementById('waypoints-container');
    var lastWaypoint = document.getElementById('waypoint-field-' + waypointCount);

    if (lastWaypoint) {
      // If this is the first waypoint and the destination is empty,
      // move the waypoint value to the destination
      if (waypointCount === 1) {
        var destValue = document.getElementById('destinationautocomplete').value;
        var waypointValue = document.getElementById('waypoint-1').value;

        if (destValue.trim() === '' && waypointValue.trim() !== '') {
          document.getElementById('destinationautocomplete').value = waypointValue;
          document.getElementById('destinationautocomplete').placeholder = 'Enter your destination address';
        }
      }

      waypointContainer.removeChild(lastWaypoint);

      // Remove the last autocomplete object
      waypointAutocompletes.pop();

      // Decrement the counter
      waypointCount--;

      // Hide the remove button if no waypoints left
      if (waypointCount === 0) {
        document.getElementById('remove-waypoint').style.display = 'none';
      }
    }
  }
}

// Calculate route with multiple waypoints
function calculateFullRoute() {
  var origin = document.getElementById('originautocomplete').value;
  var destination = document.getElementById('destinationautocomplete').value;

  if (!origin) {
    alert('Please enter an origin address');
    return;
  }

  if (!destination) {
    alert('Please enter a final destination address');
    return;
  }

  // Clear existing markers
  clearMarkers();

  // Collect waypoints
  var waypoints = [];
  var allWaypointsValid = true;

  for (var i = 1; i <= waypointCount; i++) {
    var waypointInput = document.getElementById('waypoint-' + i);
    if (waypointInput) {
      if (waypointInput.value.trim() === '') {
        alert('Please enter an address for Stop ' + i);
        allWaypointsValid = false;
        break;
      }

      waypoints.push({
        location: waypointInput.value,
        stopover: true
      });
    }
  }

  if (!allWaypointsValid) {
    return;
  }

  // If no waypoints, just use the regular function
  if (waypoints.length === 0) {
    CalculatedRecommededDistance();
    return;
  }

  // Show loading indicator
  document.getElementById('total-distance-container').style.display = 'block';
  document.getElementById('total-distance').innerHTML = 'Calculating route...';

  // Create the route request
  var request = {
    origin: origin,
    destination: destination,
    waypoints: waypoints,
    travelMode: google.maps.TravelMode.DRIVING,
    optimizeWaypoints: false, // Don't optimize to keep the order as entered
    unitSystem: google.maps.UnitSystem.METRIC
  };

  // Request the route
  directionsService.route(request, function(response, status) {
    if (status === google.maps.DirectionsStatus.OK) {
      // Set the directions on the renderer
      directionsRenderer.setDirections(response);

      // Ensure the map is visible by scrolling to it
      setTimeout(function() {
        document.getElementById('map').scrollIntoView({behavior: 'smooth', block: 'nearest'});
      }, 500);

      if (response.routes.length > 0) {
        var route = response.routes[0];
        var legs = route.legs;
        var totalDistance = 0;
        var totalDuration = 0;

        // Add markers for origin, waypoints, and destination
        var originLocation = legs[0].start_location;
        var destinationLocation = legs[legs.length - 1].end_location;

        // Add origin marker
        addMarker(originLocation, 'Origin', {
          url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
        });

        // Add destination marker
        addMarker(destinationLocation, 'Destination', {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
        });

        // Add waypoint markers
        for (var i = 0; i < legs.length - 1; i++) {
          var waypointLocation = legs[i].end_location;
          addMarker(waypointLocation, 'Stop ' + (i + 1), {
            url: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
          });
        }

        // Calculate total distance and duration
        for (var i = 0; i < legs.length; i++) {
          totalDistance += legs[i].distance.value;
          totalDuration += legs[i].duration.value;
        }

        // Convert to kilometers and minutes
        var totalDistanceKm = (totalDistance / 1000).toFixed(1);
        var totalDurationMin = Math.round(totalDuration / 60);

        // Display total distance
        var totalDistanceContainer = document.getElementById('total-distance-container');
        var totalDistanceDiv = document.getElementById('total-distance');

        totalDistanceContainer.style.display = 'block';

        // Format the total time
        var hoursText = Math.floor(totalDurationMin / 60);
        var minutesText = totalDurationMin % 60;
        var timeText = '';

        if (hoursText > 0) {
          timeText += hoursText + ' hour' + (hoursText > 1 ? 's' : '');
        }

        if (minutesText > 0) {
          if (timeText) timeText += ' ';
          timeText += minutesText + ' min' + (minutesText > 1 ? 's' : '');
        }

        // Create a detailed breakdown of the journey
        var journeyHTML = '<strong>Total Journey:</strong> ' + totalDistanceKm + ' km in ' + timeText + '<br><br>';
        journeyHTML += '<strong>Journey Breakdown:</strong><br>';

        // Add origin to first stop
        journeyHTML += '<div class="journey-segment">';
        journeyHTML += '<div class="journey-point"><i class="fas fa-map-marker-alt origin-icon"></i> ' + origin + '</div>';
        journeyHTML += '<div class="journey-arrow"><i class="fas fa-long-arrow-alt-down"></i> ' +
                      legs[0].distance.text + ' (' + legs[0].duration.text + ')</div>';

        // Add all waypoints
        for (var i = 0; i < waypoints.length; i++) {
          journeyHTML += '<div class="journey-point"><i class="fas fa-map-pin waypoint-icon"></i> Stop ' +
                        (i + 1) + ': ' + legs[i].end_address + '</div>';

          if (i < waypoints.length) {
            var nextLeg = legs[i + 1];
            if (nextLeg) {
              journeyHTML += '<div class="journey-arrow"><i class="fas fa-long-arrow-alt-down"></i> ' +
                            nextLeg.distance.text + ' (' + nextLeg.duration.text + ')</div>';
            }
          }
        }

        // Add final destination
        journeyHTML += '<div class="journey-point"><i class="fas fa-flag-checkered destination-icon"></i> ' +
                      destination + '</div>';
        journeyHTML += '</div>';

        totalDistanceDiv.innerHTML = journeyHTML;

        // For multi-stop routes, show a summary in the recommended route box
        var outputRecommendedDiv = document.getElementById('outputRecommended');
        outputRecommendedDiv.innerHTML = 'Multi-stop journey: ' + totalDistanceKm + ' km in ' + timeText;

        // Clear the longest route display
        document.getElementById('output').innerHTML = '';
      }
    } else {
      console.error('Directions request failed due to ' + status);
      alert('Could not display route. Please try again with valid addresses.');
    }
  });
}

// Reset the map to its initial state
function resetMap() {
  // Clear existing markers
  clearMarkers();

  // Clear directions
  if (directionsRenderer) {
    directionsRenderer.setDirections({routes: []});
  }

  // Reset the map center and zoom
  if (map) {
    map.setCenter({ lat: -25.2744, lng: 133.7751 }); // Default center (Australia)
    map.setZoom(4);
  }

  // If we have user location, use that instead
  if (userLocation) {
    map.setCenter(new google.maps.LatLng(userLocation.lat, userLocation.lng));
    map.setZoom(10);

    // Add a "You are here" marker
//     var userMarker = new google.maps.Marker({
//       position: new google.maps.LatLng(userLocation.lat, userLocation.lng),
//       map: map,
//       title: 'Your Location',
//       icon: {
//         path: google.maps.SymbolPath.CIRCLE,
//         scale: 10,
//         fillColor: '#4285F4',
//         fillOpacity: 0.7,
//         strokeColor: 'white',
//         strokeWeight: 2
//       },
//       animation: google.maps.Animation.DROP
//     });

//     markers.push(userMarker);
//   }

  // Show welcome message again
  var welcomeInfoWindow = new google.maps.InfoWindow({
    content: '<div class="info-window"><h3>Map Reset</h3>' +
             '<p>Enter new addresses to calculate a different route.</p></div>',
    position: map.getCenter()
  });
  welcomeInfoWindow.open(map);

  // Close the welcome message after 5 seconds
  setTimeout(function() {
    welcomeInfoWindow.close();
  }, 5000);
}