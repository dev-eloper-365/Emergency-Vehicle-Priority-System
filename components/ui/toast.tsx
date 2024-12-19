import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface ToastProps {
  title: string
  description: string
  onClose: () => void
}

export function Toast({ title, description, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 3000)

    return () => clearTimeout(timer)
  }, [onClose])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 w-64 bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          </div>
          <button
            type="button"
            className="ml-4 text-gray-400 hover:text-gray-500"
            onClick={() => {
              setIsVisible(false)
              onClose()
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

