import { useState, useEffect } from 'react'

interface RoutePoint {
  lat: number
  lng: number
}

interface UseRouteProps {
  start: [number, number] | null
  end: [number, number] | null
}

export function useRoute({ start, end }: UseRouteProps) {
  const [route, setRoute] = useState<RoutePoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!start || !end) return

    const calculateRoute = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // In a real application, you would make an API call to a routing service
        // For this example, we'll create a simple straight line route
        const points: RoutePoint[] = []
        const steps = 10

        for (let i = 0; i <= steps; i++) {
          points.push({
            lat: start[0] + (end[0] - start[0]) * (i / steps),
            lng: start[1] + (end[1] - start[1]) * (i / steps),
          })
        }

        setRoute(points)
      } catch (err) {
        setError('Failed to calculate route')
      } finally {
        setIsLoading(false)
      }
    }

    calculateRoute()
  }, [start, end])

  return { route, isLoading, error }
}

