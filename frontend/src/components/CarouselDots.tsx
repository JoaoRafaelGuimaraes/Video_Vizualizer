import './CarouselDots.css'

interface CarouselDotsProps {
  total: number
  currentIndex: number
  onDotClick: (index: number) => void
}

function CarouselDots({ total, currentIndex, onDotClick }: CarouselDotsProps) {
  return (
    <div className="dots-container">
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={`dot ${index === currentIndex ? 'active' : ''}`}
          onClick={() => onDotClick(index)}
        />
      ))}
    </div>
  )
}

export default CarouselDots
