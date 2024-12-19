export function calculateDistance(
  point1: [number, number],
  point2: [number, number]
): number {
  const R = 6371 // Earth's radius in kilometers
  const lat1 = toRad(point1[0])
  const lat2 = toRad(point2[0])
  const dLat = toRad(point2[0] - point1[0])
  const dLon = toRad(point2[1] - point1[1])

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function isVehicleInRange(
  vehiclePosition: [number, number],
  ambulancePosition: [number, number],
  range: number
): boolean {
  return calculateDistance(vehiclePosition, ambulancePosition) <= range
}

