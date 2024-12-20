'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Toast } from './toast'
interface MapProps {
  isSimulating: boolean
  onError: (error: string) => void
}

interface Vehicle {
  id: string
  marker: maplibregl.Marker
  isAlerted: boolean
}

const OPENROUTE_API_KEY = '5b3ce3597851110001cf62484720627ea924407099674626b693b31c'

export default function Map({ isSimulating, onError }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [route, setRoute] = useState<[number, number][]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const ambulanceRef = useRef<maplibregl.Marker | null>(null)
  const animationRef = useRef<number | null>(null)
  const [toast, setToast] = useState<{ title: string; description: string } | null>(null)

  useEffect(() => {
    if (!mapContainer.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://api.maptiler.com/maps/basic-v2/style.json?key=BgoYrCzPegevrMw1X6ME',
      center: [72.6369, 23.0225], // Default to Ahmedabad
      zoom: 13,
    })

    map.current.on('load', () => {
      if (!map.current) return

      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
        },
      })

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 8,
        },
      })

      generateRandomRoute()
    })

    return () => {
      map.current?.remove()
    }
  }, [])

  useEffect(() => {
    if (isSimulating) {
      startSimulation()
    } else {
      stopSimulation()
    }
  }, [isSimulating])

  const generateRandomRoute = async () => {
    if (!map.current) return

    const bounds = map.current.getBounds()
    const start: [number, number] = [
      bounds.getSouthWest().lng + Math.random() * (bounds.getNorthEast().lng - bounds.getSouthWest().lng),
      bounds.getSouthWest().lat + Math.random() * (bounds.getNorthEast().lat - bounds.getSouthWest().lat),
    ]
    const end: [number, number] = [
      bounds.getSouthWest().lng + Math.random() * (bounds.getNorthEast().lng - bounds.getSouthWest().lng),
      bounds.getSouthWest().lat + Math.random() * (bounds.getNorthEast().lat - bounds.getSouthWest().lat),
    ]

    try {
      const routeData = await fetchRoute(start, end)
      setRoute(routeData)
      drawRoute(routeData)
      generateRandomVehicles(routeData)
    } catch (error) {
      onError('Failed to generate route. Please try again.')
    }
  }

  const fetchRoute = async (start: [number, number], end: [number, number]): Promise<[number, number][]> => {
    const response = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${OPENROUTE_API_KEY}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`,
      {
        headers: {
          'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
        }
      }
    )
    const data = await response.json()
    if (data.features && data.features.length > 0) {
      return data.features[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])
    }
    throw new Error('No route found')
  }

  const drawRoute = (coordinates: [number, number][]) => {
    if (!map.current) return

    const geojson = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates.map(([lat, lng]) => [lng, lat]),
      },
    }

    ;(map.current.getSource('route') as maplibregl.GeoJSONSource).setData(geojson as any)

    const bounds = coordinates.reduce((bounds, coord) => {
      return bounds.extend(coord as maplibregl.LngLatLike)
    }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]))

    map.current.fitBounds(bounds, { padding: 50 })
  }

  const generateRandomVehicles = (routeCoords: [number, number][]) => {
    if (!map.current) return

    const newVehicles: Vehicle[] = []
    for (let i = 0; i < 20; i++) {
      let lat, lng
      if (i < 10) {
        // Place half of the vehicles on the route
        const randomIndex = Math.floor(Math.random() * (routeCoords.length - 1))
        ;[lat, lng] = routeCoords[randomIndex]
      } else {
        // Place the rest randomly on the map
        const bounds = map.current.getBounds()
        lng = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest())
        lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth())
      }

      const el = document.createElement('div')
      el.className = 'vehicle-marker'
      el.style.backgroundColor = '#00ff00' // Green color for non-alerted vehicles
      el.style.width = '10px'
      el.style.height = '10px'
      el.style.borderRadius = '50%'

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map.current)

      newVehicles.push({
        id: `vehicle-${i}`,
        marker,
        isAlerted: false,
      })
    }
    setVehicles(newVehicles)
  }

  const startSimulation = () => {
    if (!map.current || route.length === 0) return

    const [startLat, startLng] = route[0]
    const el = document.createElement('div')
    el.className = 'ambulance-marker'
    el.style.backgroundColor = '#0000ff' // Blue color for ambulance
    el.style.width = '15px'
    el.style.height = '15px'
    el.style.borderRadius = '50%'

    ambulanceRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([startLng, startLat])
      .addTo(map.current)

    let currentIndex = 0
    const animateAmbulance = () => {
      if (currentIndex >= route.length - 1) {
        stopSimulation()
        return
      }

      const [fromLat, fromLng] = route[currentIndex]
      const [toLat, toLng] = route[currentIndex + 1]
      const steps = 60 // Increase steps for smoother animation
      let step = 0

      const moveStep = () => {
        if (step >= steps) {
          currentIndex++
          animateAmbulance()
          return
        }

        const lat = fromLat + (toLat - fromLat) * (step / steps)
        const lng = fromLng + (toLng - fromLng) * (step / steps)

        if (ambulanceRef.current) {
          ambulanceRef.current.setLngLat([lng, lat])
        }

        updateVehicleAlerts([lat, lng])

        step++
        animationRef.current = requestAnimationFrame(moveStep)
      }

      moveStep()
    }

    animateAmbulance()
  }

  const stopSimulation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (ambulanceRef.current && map.current) {
      ambulanceRef.current.remove()
      ambulanceRef.current = null
    }
    setVehicles((prevVehicles) =>
      prevVehicles.map((vehicle) => {
        const el = vehicle.marker.getElement()
        el.style.backgroundColor = '#00ff00' // Reset to green
        return {
          ...vehicle,
          isAlerted: false,
        }
      })
    )
  }

  const updateVehicleAlerts = async (ambulancePosition: [number, number]) => {
    if (!ambulanceRef.current) return

    const [ambLat, ambLng] = ambulancePosition
    try {
      const alertedVehicles = await getVehiclesWithin10KmAhead(ambulancePosition)

      setVehicles((prevVehicles) =>
        prevVehicles.map((vehicle) => {
          const [vehLng, vehLat] = vehicle.marker.getLngLat().toArray()
          const isAlerted = alertedVehicles.some(v => v[0] === vehLat && v[1] === vehLng)

          const el = vehicle.marker.getElement()
          el.style.backgroundColor = isAlerted ? '#ff0000' : '#00ff00' // Red if alerted, green otherwise

          return {
            ...vehicle,
            isAlerted,
          }
        })
      )
    } catch (error) {
      console.error('Error updating vehicle alerts:', error)
      setToast({
        title: 'Error',
        description: 'Failed to update vehicle alerts. Using approximate method.'
      })
    }
  }

const getVehiclesWithin10KmAhead = async (ambulancePosition: [number, number]): Promise<[number, number][]> => {
  const [ambLat, ambLng] = ambulancePosition
  const vehiclePositions = vehicles.map(v => v.marker.getLngLat().toArray())

  try {
    const response = await fetch(
      `https://api.openrouteservice.org/v2/matrix/driving-car`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
          'Content-Type': 'application/json',
          'Authorization': OPENROUTE_API_KEY
        },
        body: JSON.stringify({
          locations: [[ambLng, ambLat], ...vehiclePositions],
          sources: [0],
          destinations: Array.from({ length: vehiclePositions.length }, (_, i) => i + 1),
          metrics: ['distance'],
          units: 'km'
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('OpenRouteService API Response:', data) // Add logging to check the response

    if (!data.distances || !Array.isArray(data.distances[0])) {
      throw new Error('Invalid response format or missing distances')
    }

    const distances = data.distances[0]

    return vehiclePositions.filter((_, index) => distances[index] <= 10 && distances[index] > 0)
  } catch (error) {
    console.error('Error calculating distances:', error)
    // Fallback to a simple distance calculation if the API fails
    return vehiclePositions.filter(([vehLat, vehLng]) => {
      const distance = calculateSimpleDistance([ambLat, ambLng], [vehLat, vehLng])
      return distance <= 10 && distance > 0
    })
  }
}


  const calculateSimpleDistance = (point1: [number, number], point2: [number, number]): number => {
    const [lat1, lon1] = point1
    const [lat2, lon2] = point2
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  return (
    <>
      <div ref={mapContainer} className="w-full h-[600px]" />
      {toast && (
        <Toast
          title={toast.title}
          description={toast.description}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}

