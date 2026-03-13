"use client"

import { cn } from "@/lib/utils"

type Direction = "down" | "up" | "left" | "right"

interface PixelCharacterProps {
  direction: Direction
  isWalking: boolean
  walkFrame: number
}

export function PixelCharacter({ direction, isWalking, walkFrame }: PixelCharacterProps) {
  // Simple pixel art character using CSS grid
  // Each frame alternates leg positions for walking animation
  
  const getCharacterSprite = () => {
    const frame = isWalking ? walkFrame % 4 : 0
    
    // Base colors
    const skin = "#FFD4A3"
    const hair = "#4A3728"
    const shirt = "#E63946"
    const pants = "#1D3557"
    const shoes = "#2D2D2D"
    const outline = "#1A1A2E"
    const eye = "#1A1A2E"
    const white = "#FFFFFF"
    
    // 16x24 pixel sprite
    const sprites: Record<Direction, string[][]> = {
      down: [
        // Frame variations based on walkFrame
        ...(frame === 0 || frame === 2 ? [
          ["", "", "", "", "", hair, hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", hair, hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", outline, skin, skin, white, eye, skin, skin, white, eye, skin, skin, outline, "", ""],
          ["", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", ""],
          ["", "", "", outline, skin, skin, skin, "#FF9999", skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, skin, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, skin, outline, "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, pants, pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, "", pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, "", pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, outline, "", outline, pants, pants, outline, "", "", "", ""],
          ["", "", "", outline, shoes, shoes, outline, "", outline, shoes, shoes, outline, "", "", "", ""],
        ] : frame === 1 ? [
          ["", "", "", "", "", hair, hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", hair, hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", outline, skin, skin, white, eye, skin, skin, white, eye, skin, skin, outline, "", ""],
          ["", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", ""],
          ["", "", "", outline, skin, skin, skin, "#FF9999", skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, skin, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, skin, outline, "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, pants, pants, pants, pants, outline, "", "", "", ""],
          ["", "", outline, pants, pants, pants, "", "", "", pants, pants, pants, outline, "", "", ""],
          ["", "", outline, pants, pants, outline, "", "", "", outline, pants, pants, outline, "", "", ""],
          ["", "", outline, shoes, shoes, outline, "", "", "", "", outline, pants, outline, "", "", ""],
          ["", "", "", "", "", "", "", "", "", "", outline, shoes, outline, "", "", ""],
        ] : [
          ["", "", "", "", "", hair, hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", hair, hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", outline, skin, skin, white, eye, skin, skin, white, eye, skin, skin, outline, "", ""],
          ["", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", ""],
          ["", "", "", outline, skin, skin, skin, "#FF9999", skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, skin, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, skin, outline, "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, pants, pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, "", "", pants, pants, pants, outline, "", "", ""],
          ["", "", "", outline, pants, pants, outline, "", "", outline, pants, pants, outline, "", "", ""],
          ["", "", "", outline, pants, outline, "", "", "", "", outline, shoes, outline, "", "", ""],
          ["", "", "", outline, shoes, outline, "", "", "", "", "", "", "", "", "", ""],
        ]),
      ],
      up: [
        ...(frame === 0 || frame === 2 ? [
          ["", "", "", "", "", hair, hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", hair, hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", hair, hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, skin, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, skin, outline, "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, pants, pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, "", pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, "", pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, outline, "", outline, pants, pants, outline, "", "", "", ""],
          ["", "", "", outline, shoes, shoes, outline, "", outline, shoes, shoes, outline, "", "", "", ""],
        ] : frame === 1 ? [
          ["", "", "", "", "", hair, hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", hair, hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", hair, hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, skin, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, skin, outline, "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, pants, pants, pants, pants, outline, "", "", "", ""],
          ["", "", outline, pants, pants, pants, "", "", "", pants, pants, pants, outline, "", "", ""],
          ["", "", outline, pants, pants, outline, "", "", "", outline, pants, pants, outline, "", "", ""],
          ["", "", outline, shoes, shoes, outline, "", "", "", "", outline, pants, outline, "", "", ""],
          ["", "", "", "", "", "", "", "", "", "", outline, shoes, outline, "", "", ""],
        ] : [
          ["", "", "", "", "", hair, hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", hair, hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", hair, hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", ""],
          ["", "", outline, skin, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, skin, outline, "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, pants, pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, "", "", pants, pants, pants, outline, "", "", ""],
          ["", "", "", outline, pants, pants, outline, "", "", outline, pants, pants, outline, "", "", ""],
          ["", "", "", outline, pants, outline, "", "", "", "", outline, shoes, outline, "", "", ""],
          ["", "", "", outline, shoes, outline, "", "", "", "", "", "", "", "", "", ""],
        ]),
      ],
      left: [
        ...(frame === 0 || frame === 2 ? [
          ["", "", "", "", "", "", hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", "", hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", outline, skin, skin, white, eye, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, "#FF9999", skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", "", outline, skin, skin, skin, outline, "", "", "", "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", skin, skin, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", "", ""],
          ["", "", "", "", outline, pants, pants, pants, pants, pants, outline, "", "", "", "", ""],
          ["", "", "", "", outline, pants, pants, "", pants, pants, outline, "", "", "", "", ""],
          ["", "", "", "", outline, pants, pants, "", pants, pants, outline, "", "", "", "", ""],
          ["", "", "", "", outline, pants, outline, "", outline, pants, outline, "", "", "", "", ""],
          ["", "", "", "", outline, shoes, outline, "", outline, shoes, outline, "", "", "", "", ""],
        ] : frame === 1 ? [
          ["", "", "", "", "", "", hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", "", hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", outline, skin, skin, white, eye, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, "#FF9999", skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", "", outline, skin, skin, skin, outline, "", "", "", "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", skin, skin, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", "", ""],
          ["", "", "", "", outline, pants, pants, pants, pants, pants, outline, "", "", "", "", ""],
          ["", "", "", outline, pants, pants, pants, "", "", pants, outline, "", "", "", "", ""],
          ["", "", "", outline, pants, pants, outline, "", "", outline, pants, outline, "", "", "", ""],
          ["", "", outline, shoes, shoes, outline, "", "", "", "", pants, outline, "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", "", shoes, outline, "", "", "", ""],
        ] : [
          ["", "", "", "", "", "", hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", "", hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", outline, skin, skin, white, eye, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", outline, skin, skin, skin, skin, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, "#FF9999", skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", "", outline, skin, skin, skin, outline, "", "", "", "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", skin, skin, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", "", ""],
          ["", "", "", "", outline, pants, pants, pants, pants, pants, outline, "", "", "", "", ""],
          ["", "", "", "", outline, pants, "", "", pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", "", outline, pants, outline, "", outline, pants, pants, outline, "", "", "", ""],
          ["", "", "", "", pants, outline, "", "", "", outline, shoes, outline, "", "", "", ""],
          ["", "", "", "", shoes, outline, "", "", "", "", "", "", "", "", "", ""],
        ]),
      ],
      right: [
        ...(frame === 0 || frame === 2 ? [
          ["", "", "", "", "", hair, hair, hair, hair, hair, "", "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, eye, white, skin, skin, outline, "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", "", "", "", outline, skin, "#FF9999", skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", "", "", outline, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, skin, skin, "", "", ""],
          ["", "", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", "", "", outline, pants, pants, pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", "", "", outline, pants, pants, "", pants, pants, outline, "", "", "", ""],
          ["", "", "", "", "", outline, pants, pants, "", pants, pants, outline, "", "", "", ""],
          ["", "", "", "", "", outline, pants, outline, "", outline, pants, outline, "", "", "", ""],
          ["", "", "", "", "", outline, shoes, outline, "", outline, shoes, outline, "", "", "", ""],
        ] : frame === 1 ? [
          ["", "", "", "", "", hair, hair, hair, hair, hair, "", "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, eye, white, skin, skin, outline, "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", "", "", "", outline, skin, "#FF9999", skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", "", "", outline, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, skin, skin, "", "", ""],
          ["", "", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", "", "", outline, pants, pants, pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", "", "", outline, pants, "", "", pants, pants, pants, outline, "", "", ""],
          ["", "", "", "", outline, pants, outline, "", "", outline, pants, pants, outline, "", "", ""],
          ["", "", "", "", outline, pants, "", "", "", "", outline, shoes, outline, "", "", ""],
          ["", "", "", "", outline, shoes, "", "", "", "", "", "", "", "", "", ""],
        ] : [
          ["", "", "", "", "", hair, hair, hair, hair, hair, "", "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, "", "", "", "", ""],
          ["", "", "", "", hair, hair, hair, hair, hair, hair, hair, hair, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, skin, outline, "", "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, eye, white, skin, skin, outline, "", "", ""],
          ["", "", "", "", outline, skin, skin, skin, skin, skin, skin, skin, outline, "", "", ""],
          ["", "", "", "", "", outline, skin, "#FF9999", skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", "", "", outline, skin, skin, skin, outline, "", "", "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, outline, "", "", ""],
          ["", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, shirt, skin, skin, "", "", ""],
          ["", "", "", "", "", outline, shirt, shirt, shirt, shirt, shirt, outline, "", "", "", ""],
          ["", "", "", "", "", outline, pants, pants, pants, pants, pants, outline, "", "", "", ""],
          ["", "", "", "", outline, pants, pants, pants, "", "", pants, outline, "", "", "", ""],
          ["", "", "", "", outline, pants, pants, outline, "", "", outline, pants, outline, "", "", ""],
          ["", "", "", "", outline, shoes, outline, "", "", "", "", pants, outline, "", "", ""],
          ["", "", "", "", "", "", "", "", "", "", "", shoes, outline, "", "", ""],
        ]),
      ],
    }
    
    return sprites[direction]
  }
  
  const sprite = getCharacterSprite()
  const pixelSize = 4 // Each pixel is 4px
  
  return (
    <div 
      className="relative"
      style={{ 
        width: 16 * pixelSize, 
        height: 18 * pixelSize,
        imageRendering: "pixelated"
      }}
    >
      {sprite.map((row, y) => (
        row.map((color, x) => (
          color && (
            <div
              key={`${x}-${y}`}
              className="absolute"
              style={{
                width: pixelSize,
                height: pixelSize,
                left: x * pixelSize,
                top: y * pixelSize,
                backgroundColor: color,
              }}
            />
          )
        ))
      ))}
    </div>
  )
}
