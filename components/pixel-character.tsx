"use client"

import { useEffect, useState } from "react"

const SHINOBI_BASE = "/sprites/shinobi"
const FRAME_SIZE = 32
const WALK_FRAMES = 6

type Direction = "down" | "up" | "left" | "right"

const SPRITE_PATHS = {
  idle: `${SHINOBI_BASE}/shinobi.png`,
  walkSouth: `${SHINOBI_BASE}/shinobi-walk-south.png`,
  walkNorth: `${SHINOBI_BASE}/shinobi-walk-north.png`,
  walkEast: `${SHINOBI_BASE}/shinobi-walk-east.png`,
  walkWest: `${SHINOBI_BASE}/shinobi-walk-west.png`,
} as const

/** Idle sheet shinobi.png is 128x32; frame order is south, east, north, west (0,1,2,3). */
const IDLE_FRAME_BY_DIRECTION: Record<Direction, number> = {
  down: 0,  // south
  right: 1, // east
  up: 2,    // north
  left: 3,  // west
}

interface PixelCharacterProps {
  direction: Direction
  isWalking: boolean
  walkFrame: number
}

const WALK_SHEET_BY_DIRECTION: Record<Direction, string> = {
  down: SPRITE_PATHS.walkSouth,
  up: SPRITE_PATHS.walkNorth,
  right: SPRITE_PATHS.walkEast,
  left: SPRITE_PATHS.walkWest,
}

function preloadShinobiSprites(onAllLoaded: () => void): void {
  const urls = Object.values(SPRITE_PATHS)
  let loaded = 0
  urls.forEach((src) => {
    const img = new Image()
    img.onload = () => {
      loaded += 1
      if (loaded === urls.length) onAllLoaded()
    }
    img.onerror = () => {
      loaded += 1
      if (loaded === urls.length) onAllLoaded()
    }
    img.src = src
  })
}

export function PixelCharacter({ direction, isWalking, walkFrame }: PixelCharacterProps) {
  const [spritesLoaded, setSpritesLoaded] = useState(false)

  useEffect(() => {
    preloadShinobiSprites(() => setSpritesLoaded(true))
  }, [])

  if (!spritesLoaded) {
    return <PlaceholderCharacter direction={direction} isWalking={isWalking} walkFrame={walkFrame} />
  }

  const frameIndex = isWalking ? walkFrame % WALK_FRAMES : 0

  return (
    <div
      className="relative flex-shrink-0"
      style={{
        width: FRAME_SIZE,
        height: FRAME_SIZE,
        imageRendering: "pixelated",
      }}
    >
      {isWalking ? (
        <div
          style={{
            width: FRAME_SIZE,
            height: FRAME_SIZE,
            overflow: "hidden",
            backgroundImage: `url(${WALK_SHEET_BY_DIRECTION[direction]})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: `${-frameIndex * FRAME_SIZE}px 0`,
            backgroundSize: "auto 100%",
          }}
        />
      ) : (
        <div
          style={{
            width: FRAME_SIZE,
            height: FRAME_SIZE,
            overflow: "hidden",
            backgroundImage: `url(${SPRITE_PATHS.idle})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: `${-IDLE_FRAME_BY_DIRECTION[direction] * FRAME_SIZE}px 0`,
            backgroundSize: "auto 100%",
          }}
        />
      )}
    </div>
  )
}

function PlaceholderCharacter(_props: {
  direction: Direction
  isWalking: boolean
  walkFrame: number
}) {
  const skin = "#FFD4A3"
  const hair = "#4A3728"
  const shirt = "#E63946"
  const pants = "#1D3557"
  const shoes = "#2D2D2D"
  const outline = "#1A1A2E"
  const eye = "#1A1A2E"
  const white = "#FFFFFF"

  const downSprite = [
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
  ]

  const pixelSize = 4
  const sprite = downSprite

  return (
    <div
      className="relative"
      style={{
        width: 16 * pixelSize,
        height: 18 * pixelSize,
        imageRendering: "pixelated",
      }}
    >
      {sprite.map((row, y) =>
        row.map((color, x) =>
          color ? (
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
          ) : null
        )
      )}
    </div>
  )
}
