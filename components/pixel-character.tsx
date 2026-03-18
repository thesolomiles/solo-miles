"use client"

import { useEffect, useState } from "react"

const DEFAULT_BASE = "/sprites/shinobi"
/** Source sprite frame size (current assets are 48x48, 4 frames horizontally in a 192x48 sheet). */
const FRAME_SIZE = 48
/** Tile size for feet alignment. */
const TILE_SIZE = 32

/** On-screen render size: uniform scale, 1.5x (72x72). */
export const RENDER_SIZE = 72
/** Horizontal offset to center sprite over tile: renderX = tileX - RENDER_OFFSET_X. */
export const RENDER_OFFSET_X = (RENDER_SIZE - TILE_SIZE) / 2
/** Vertical offset so feet stay on tile: renderY = tileY - FEET_OFFSET_Y. */
export const FEET_OFFSET_Y = RENDER_SIZE - TILE_SIZE

/** Visual-only: player sprite anchor (feet vs logic tile). + right, + down. Tweak in one place. */
export const PLAYER_SPRITE_OFFSET_X = 12
export const PLAYER_SPRITE_OFFSET_Y = 56

/** Visual-only: NPC sprite anchor. Start equal to player, tweak separately if needed. */
export const NPC_SPRITE_OFFSET_X = 10
export const NPC_SPRITE_OFFSET_Y = 32

const WALK_FRAMES = 4
const IDLE_FRAMES = 4

type Direction = "down" | "up" | "left" | "right"

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
  /** Optional sprite base folder, e.g. \"/sprites/NPC-CHAD\". Defaults to player sprite base. */
  spriteBase?: string
}
function buildSpritePaths(base: string) {
  return {
    idle: `${base}/shinobi.png`,
    walkSouth: `${base}/shinobi-walk-south.png`,
    walkNorth: `${base}/shinobi-walk-north.png`,
    walkEast: `${base}/shinobi-walk-east.png`,
    walkWest: `${base}/shinobi-walk-west.png`,
  } as const
}

function preloadSpriteSet(paths: ReturnType<typeof buildSpritePaths>, onAllLoaded: () => void): void {
  const urls = Object.values(paths)
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

export function PixelCharacter({ direction, isWalking, walkFrame, spriteBase }: PixelCharacterProps) {
  const base = spriteBase ?? DEFAULT_BASE
  const paths = buildSpritePaths(base)
  const walkSheetByDirection: Record<Direction, string> = {
    down: paths.walkSouth,
    up: paths.walkNorth,
    right: paths.walkEast,
    left: paths.walkWest,
  }

  function isValidFrame(dir: Direction, frame: number): boolean {
    return dir != null && Number.isFinite(frame) && frame >= 0
  }

  const [spritesLoaded, setSpritesLoaded] = useState(false)
  const [lastValidDirection, setLastValidDirection] = useState<Direction>(direction)
  const [lastValidFrame, setLastValidFrame] = useState<number>(walkFrame)

  useEffect(() => {
    preloadSpriteSet(paths, () => setSpritesLoaded(true))
  }, [])

  useEffect(() => {
    if (isValidFrame(direction, walkFrame)) {
      setLastValidDirection(direction)
      setLastValidFrame(walkFrame)
    }
  }, [direction, walkFrame])

  // Keep component mounted; avoid returning null on load.
  // If sprites aren't loaded yet, we render the same DOM structure with no backgroundImage.

  const safeDirection = isValidFrame(direction, walkFrame) ? direction : lastValidDirection
  const safeFrame = isValidFrame(direction, walkFrame) ? walkFrame : lastValidFrame

  const clampedWalkFrame = Math.max(0, Math.min(Math.floor(safeFrame), WALK_FRAMES - 1))
  const walkFrameIndex = clampedWalkFrame

  const idleFrameIndex = IDLE_FRAME_BY_DIRECTION[safeDirection]
  const clampedIdleFrameIndex = Math.max(0, Math.min(idleFrameIndex, IDLE_FRAMES - 1))

  const frameStyle: React.CSSProperties = {
    width: RENDER_SIZE,
    height: RENDER_SIZE,
    overflow: "hidden",
    imageRendering: "pixelated",
  }

  const hiddenLayerStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    opacity: 0,
    pointerEvents: "none",
  }

  const visibleLayerStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    opacity: 1,
    pointerEvents: "none",
  }

  const walkLayerStyle = (dir: Direction): React.CSSProperties => ({
    ...frameStyle,
    backgroundImage: spritesLoaded ? `url(${walkSheetByDirection[dir]})` : undefined,
    backgroundRepeat: "no-repeat",
    backgroundPosition: `${-walkFrameIndex * RENDER_SIZE}px 0`,
    backgroundSize: `${WALK_FRAMES * RENDER_SIZE}px ${RENDER_SIZE}px`,
  })

  const idleStyle: React.CSSProperties = {
    ...frameStyle,
    backgroundImage: spritesLoaded ? `url(${paths.idle})` : undefined,
    backgroundRepeat: "no-repeat",
    backgroundPosition: `${-clampedIdleFrameIndex * RENDER_SIZE}px 0`,
    backgroundSize: `${IDLE_FRAMES * RENDER_SIZE}px ${RENDER_SIZE}px`,
  }

  return (
    <div
      className="relative flex-shrink-0"
      style={{ position: "relative", width: RENDER_SIZE, height: RENDER_SIZE, flexShrink: 0 }}
    >
      {/* Idle layer (single sheet; backgroundImage stable) */}
      <div style={isWalking ? hiddenLayerStyle : visibleLayerStyle}>
        <div style={idleStyle} />
      </div>

      {/* Walk layers (4 sheets kept mounted; switch by opacity only) */}
      <div style={!isWalking ? hiddenLayerStyle : safeDirection === "down" ? visibleLayerStyle : hiddenLayerStyle}>
        <div style={walkLayerStyle("down")} />
      </div>
      <div style={!isWalking ? hiddenLayerStyle : safeDirection === "up" ? visibleLayerStyle : hiddenLayerStyle}>
        <div style={walkLayerStyle("up")} />
      </div>
      <div style={!isWalking ? hiddenLayerStyle : safeDirection === "left" ? visibleLayerStyle : hiddenLayerStyle}>
        <div style={walkLayerStyle("left")} />
      </div>
      <div style={!isWalking ? hiddenLayerStyle : safeDirection === "right" ? visibleLayerStyle : hiddenLayerStyle}>
        <div style={walkLayerStyle("right")} />
      </div>
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
