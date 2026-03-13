"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { PixelCharacter } from "./pixel-character"

type Direction = "down" | "up" | "left" | "right"

// Tile types
const TILE = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  FLOWER_RED: 3,
  FLOWER_YELLOW: 4,
  TREE: 5,
  HOUSE_1: 6,
  HOUSE_2: 7,
  HOUSE_3: 8,
  FENCE: 9,
  SIGN: 10,
  WELL: 11,
  TALL_GRASS: 12,
  CAMPFIRE: 13,
} as const

type TileType = typeof TILE[keyof typeof TILE]

// Tile size in pixels
const TILE_SIZE = 48

// Map dimensions (in tiles)
const MAP_WIDTH = 50
const MAP_HEIGHT = 24

// Define collision tiles (non-walkable)
const COLLISION_TILES = [TILE.WATER, TILE.TREE, TILE.HOUSE_1, TILE.HOUSE_2, TILE.HOUSE_3, TILE.FENCE, TILE.WELL]

// Town map layout - expanded with route, second town, and secret forest
// Town 1 (Pallet Town): tiles 0-19
// Route 1: tiles 20-34
// Town 2 (Viridian Town): tiles 35-49
// Secret Forest: north of Viridian Town (rows 0-8)
const TOWN_MAP: TileType[][] = [
  // Row 0 - top border (secret forest area)
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  // Row 1 - secret forest clearing surrounded by trees
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 3, 4, 5, 5, 5, 5],
  // Row 2 - secret clearing
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 0, 0, 0, 4, 5, 5, 5],
  // Row 3 - clearing with flowers and campfire
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 0, 0, 13, 0, 0, 3, 5, 5],
  // Row 4 - clearing area
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 4, 0, 3, 0, 0, 5, 5],
  // Row 5 - path through bushes turns west (tall grass)
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 12, 12, 12, 12, 4, 5, 5, 5],
  // Row 6 - tall grass path continues south through dense trees
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 12, 12, 5, 5, 5, 5, 5],
  // Row 7 - narrow tall grass path through forest
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 12, 12, 5, 5, 5, 5, 5, 5],
  // Row 8 - path entry hidden between trees (north of Viridian)
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 12, 12, 5, 5, 5, 5, 5, 5, 5],
  // Row 9 - top border of main world / entry to secret path
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 12, 12, 5, 5, 5, 5, 5, 5, 5, 5],
  // Row 10 (old row 1)
  [5, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 5, 0, 3, 0, 0, 5, 0, 4, 0, 0, 5, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  // Row 11 (old row 2)
  [5, 0, 6, 6, 0, 1, 1, 0, 7, 7, 7, 0, 0, 1, 1, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 5, 0, 5, 0, 0, 5, 0, 0, 0, 0, 5, 0, 7, 7, 0, 1, 1, 0, 8, 8, 0, 6, 6, 0, 5],
  // Row 12 (old row 3)
  [5, 0, 6, 6, 0, 1, 1, 0, 7, 7, 7, 0, 0, 1, 1, 0, 8, 8, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 5, 0, 0, 0, 4, 0, 5, 0, 7, 7, 0, 1, 1, 0, 8, 8, 0, 6, 6, 0, 5],
  // Row 13 (old row 4)
  [5, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 4, 0, 5, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 5],
  // Row 14 (old row 5)
  [5, 0, 9, 9, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 9, 9, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 9, 0, 1, 1, 1, 1, 1, 1, 0, 9, 0, 5],
  // Row 15 (old row 6)
  [5, 0, 0, 0, 0, 1, 1, 1, 1, 11, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 11, 1, 0, 0, 0, 5],
  // Row 16 (old row 7) - main horizontal path
  [5, 3, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 4, 1, 1, 0, 5, 0, 3, 0, 5, 0, 4, 0, 5, 0, 3, 0, 5, 1, 1, 0, 0, 3, 1, 1, 1, 1, 1, 1, 0, 0, 4, 5],
  // Row 17 (old row 8)
  [5, 0, 0, 10, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 10, 0, 0, 1, 1, 0, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 1, 1, 0, 10, 0, 1, 1, 1, 1, 1, 1, 0, 10, 0, 5],
  // Row 18 (old row 9)
  [5, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 5],
  // Row 19 (old row 10)
  [5, 0, 6, 6, 0, 1, 1, 0, 8, 8, 0, 7, 7, 1, 1, 0, 6, 6, 0, 0, 0, 5, 0, 0, 4, 0, 5, 0, 3, 0, 5, 0, 4, 0, 0, 0, 0, 0, 6, 6, 1, 1, 0, 7, 7, 0, 8, 8, 0, 5],
  // Row 20 (old row 11)
  [5, 0, 6, 6, 0, 1, 1, 0, 8, 8, 0, 7, 7, 1, 1, 0, 6, 6, 0, 0, 5, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 5, 0, 5, 0, 6, 6, 1, 1, 0, 7, 7, 0, 8, 8, 0, 5],
  // Row 21 (old row 12)
  [5, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 7, 7, 1, 1, 0, 0, 0, 0, 5, 0, 0, 5, 0, 0, 5, 5, 0, 0, 5, 5, 0, 0, 5, 0, 0, 5, 0, 0, 0, 1, 1, 0, 7, 7, 0, 0, 0, 0, 5],
  // Row 22 (old row 13)
  [5, 4, 0, 3, 0, 0, 0, 0, 3, 4, 0, 0, 0, 0, 0, 0, 3, 0, 4, 0, 0, 5, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 5, 0, 0, 3, 4, 0, 0, 0, 0, 0, 0, 3, 0, 4, 5],
  // Row 23 - bottom border
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
]

// Time of day types
type TimeOfDay = "day" | "dusk" | "night" | "dawn"

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 18) return "day"
  if (hour >= 18 && hour < 20) return "dusk"
  if (hour >= 20 || hour < 5) return "night"
  return "dawn"
}

function getNightOverlayOpacity(timeOfDay: TimeOfDay): number {
  switch (timeOfDay) {
    case "day": return 0
    case "dawn": return 0.25
    case "dusk": return 0.35
    case "night": return 0.6
  }
}

function getNightTint(timeOfDay: TimeOfDay): string {
  switch (timeOfDay) {
    case "day": return "transparent"
    case "dawn": return "rgba(255, 180, 100, 0.15)"
    case "dusk": return "rgba(255, 120, 50, 0.2)"
    case "night": return "rgba(20, 30, 80, 0.6)"
  }
}

export function GameWorld() {
  // Position in pixels (spawn in Pallet Town center - row 16 is main path)
  const [position, setPosition] = useState({ x: 9 * TILE_SIZE, y: 16 * TILE_SIZE })
  const [direction, setDirection] = useState<Direction>("down")
  const [isWalking, setIsWalking] = useState(false)
  const [walkFrame, setWalkFrame] = useState(0)
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 640 })
  const [rustlingTiles, setRustlingTiles] = useState<Set<string>>(new Set())
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day")
  const [manualTimeOverride, setManualTimeOverride] = useState<TimeOfDay | null>(null)
  const keysPressed = useRef<Set<string>>(new Set())
  const animationRef = useRef<number | null>(null)
  const lastFrameTime = useRef<number>(0)
  
  // Update time of day periodically (only when not manually overridden)
  useEffect(() => {
    if (manualTimeOverride === null) {
      setTimeOfDay(getTimeOfDay())
      const interval = setInterval(() => {
        setTimeOfDay(getTimeOfDay())
      }, 60000) // Check every minute
      return () => clearInterval(interval)
    }
  }, [manualTimeOverride])
  
  // Apply manual override
  useEffect(() => {
    if (manualTimeOverride !== null) {
      setTimeOfDay(manualTimeOverride)
    }
  }, [manualTimeOverride])
  
  const toggleDayNight = () => {
    if (manualTimeOverride === "night" || (manualTimeOverride === null && timeOfDay === "night")) {
      setManualTimeOverride("day")
    } else {
      setManualTimeOverride("night")
    }
  }
  
  const MOVE_SPEED = 3
  const FRAME_RATE = 120
  const CAMERA_SMOOTHNESS = 0.08 // Lower = smoother, higher = snappier
  
  // Character hitbox (smaller than tile for smoother movement)
  const CHARACTER_WIDTH = 24
  const CHARACTER_HEIGHT = 24

  const handleVirtualKey = useCallback((key: string, isDown: boolean) => {
    if (isDown) {
      keysPressed.current.add(key)
    } else {
      keysPressed.current.delete(key)
    }
  }, [])
  
  const canMoveTo = useCallback((newX: number, newY: number) => {
    // Check all four corners of character hitbox
    const checkPoints = [
      { x: newX + 12, y: newY + 20 }, // center bottom
      { x: newX + 4, y: newY + 20 },  // left bottom
      { x: newX + 20, y: newY + 20 }, // right bottom
      { x: newX + 12, y: newY + 30 }, // feet
    ]
    
    for (const point of checkPoints) {
      const tileX = Math.floor(point.x / TILE_SIZE)
      const tileY = Math.floor(point.y / TILE_SIZE)
      
      // Check bounds
      if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) {
        return false
      }
      
      // Check collision
      const tile = TOWN_MAP[tileY][tileX]
      if (COLLISION_TILES.includes(tile)) {
        return false
      }
    }
    
    return true
  }, [])
  
  const updateMovement = useCallback((timestamp: number) => {
    const keys = keysPressed.current
    
    if (keys.size === 0) {
      setIsWalking(false)
      animationRef.current = requestAnimationFrame(updateMovement)
      return
    }
    
    setIsWalking(true)
    
    if (timestamp - lastFrameTime.current > FRAME_RATE) {
      setWalkFrame(prev => (prev + 1) % 4)
      lastFrameTime.current = timestamp
    }
    
    let dx = 0
    let dy = 0
    
    if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) {
      dy = -MOVE_SPEED
      setDirection("up")
    }
    if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) {
      dy = MOVE_SPEED
      setDirection("down")
    }
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) {
      dx = -MOVE_SPEED
      setDirection("left")
    }
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) {
      dx = MOVE_SPEED
      setDirection("right")
    }
    
    if (dx !== 0 || dy !== 0) {
      setPosition(prev => {
        const newX = dx !== 0 && canMoveTo(prev.x + dx, prev.y) ? prev.x + dx : prev.x
        const newY = dy !== 0 && canMoveTo(prev.x, prev.y + dy) ? prev.y + dy : prev.y
        return { x: newX, y: newY }
      })
    }
    
    animationRef.current = requestAnimationFrame(updateMovement)
  }, [canMoveTo])
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(e.key)) {
        e.preventDefault()
        keysPressed.current.add(e.key)
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key)
      if (e.key === e.key.toLowerCase()) {
        keysPressed.current.delete(e.key.toUpperCase())
      } else {
        keysPressed.current.delete(e.key.toLowerCase())
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    
    animationRef.current = requestAnimationFrame(updateMovement)
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [updateMovement])
  
  // Handle viewport resize
  useEffect(() => {
    const updateViewport = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    }
    updateViewport()
    window.addEventListener("resize", updateViewport)
    return () => window.removeEventListener("resize", updateViewport)
  }, [])
  
  // Smooth camera following with lerp
  useEffect(() => {
    const CHARACTER_WIDTH = 24
    const CHARACTER_HEIGHT = 24
    
    // Calculate target camera position (player centered)
    const targetX = Math.max(0, Math.min(
      position.x - viewportSize.width / 2 + CHARACTER_WIDTH / 2,
      MAP_WIDTH * TILE_SIZE - viewportSize.width
    ))
    const targetY = Math.max(0, Math.min(
      position.y - viewportSize.height / 2 + CHARACTER_HEIGHT / 2,
      MAP_HEIGHT * TILE_SIZE - viewportSize.height
    ))
    
    // Lerp camera towards target
    const lerpCamera = () => {
      setCameraPos(prev => {
        const newX = prev.x + (targetX - prev.x) * CAMERA_SMOOTHNESS
        const newY = prev.y + (targetY - prev.y) * CAMERA_SMOOTHNESS
        
        // Stop updating when close enough
        if (Math.abs(newX - targetX) < 0.5 && Math.abs(newY - targetY) < 0.5) {
          return { x: targetX, y: targetY }
        }
        
        return { x: newX, y: newY }
      })
    }
    
    const cameraFrame = requestAnimationFrame(function animate() {
      lerpCamera()
      requestAnimationFrame(animate)
    })
    
    return () => cancelAnimationFrame(cameraFrame)
  }, [position, viewportSize])
  
  // Check if player is in tall grass and trigger rustling animation
  useEffect(() => {
    const playerTileX = Math.floor((position.x + 12) / TILE_SIZE)
    const playerTileY = Math.floor((position.y + 24) / TILE_SIZE)
    
    // Check surrounding tiles for tall grass
    const tilesToCheck = [
      { x: playerTileX, y: playerTileY },
      { x: playerTileX - 1, y: playerTileY },
      { x: playerTileX + 1, y: playerTileY },
    ]
    
    tilesToCheck.forEach(({ x, y }) => {
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
        if (TOWN_MAP[y][x] === TILE.TALL_GRASS) {
          const key = `${x}-${y}`
          setRustlingTiles(prev => {
            const newSet = new Set(prev)
            newSet.add(key)
            return newSet
          })
          
          // Remove rustling after animation completes
          setTimeout(() => {
            setRustlingTiles(prev => {
              const newSet = new Set(prev)
              newSet.delete(key)
              return newSet
            })
          }, 400)
        }
      }
    })
  }, [position])
  
  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: "#5AAF3A" }}>
      {/* World container that moves with camera */}
      <div 
        className="absolute"
        style={{
          width: MAP_WIDTH * TILE_SIZE,
          height: MAP_HEIGHT * TILE_SIZE,
          transform: `translate(${-cameraPos.x}px, ${-cameraPos.y}px)`,
          imageRendering: "pixelated"
        }}
      >
        {/* Render tiles */}
        {TOWN_MAP.map((row, y) => 
          row.map((tile, x) => (
            <Tile 
              key={`${x}-${y}`} 
              type={tile} 
              x={x} 
              y={y} 
              isRustling={rustlingTiles.has(`${x}-${y}`)}
              isNight={timeOfDay === "night" || timeOfDay === "dusk"}
            />
          ))
        )}
        
        {/* Character */}
        <div 
          className="absolute"
          style={{ 
            left: position.x,
            top: position.y,
            zIndex: Math.floor(position.y + 40)
          }}
        >
          <PixelCharacter 
            direction={direction} 
            isWalking={isWalking} 
            walkFrame={walkFrame}
          />
        </div>
      </div>
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-[1000]">
        <div 
          className="px-4 py-2 text-sm font-mono"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            color: "#FFE066",
            border: "3px solid #FFE066",
            borderRadius: 2,
            imageRendering: "pixelated"
          }}
        >
          {position.y < 10 * TILE_SIZE 
            ? "SECRET FOREST" 
            : position.x < 20 * TILE_SIZE 
              ? "PALLET TOWN" 
              : position.x < 35 * TILE_SIZE 
                ? "ROUTE 1" 
                : "VIRIDIAN TOWN"}
        </div>
        <div 
          className="px-3 py-1.5 text-xs font-mono"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            color: "#FFFFFF",
            border: "2px solid #888",
            borderRadius: 2
          }}
        >
          Arrow Keys / WASD to move
        </div>
        <button
          type="button"
          onClick={toggleDayNight}
          className="px-3 py-1.5 text-xs font-mono mt-1"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            color: "#FFE066",
            border: "2px solid #FFE066",
            borderRadius: 2,
            imageRendering: "pixelated",
            cursor: "pointer",
          }}
        >
          Toggle Day / Night
        </button>
      </div>
      
      {/* Mobile direction controller (virtual D-pad) */}
      {viewportSize.width < 768 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2">
          <button
            type="button"
            className="w-12 h-12 rounded bg-black/70 text-xs font-mono text-white border border-white/60"
            onMouseDown={(e) => { e.preventDefault(); handleVirtualKey("ArrowUp", true) }}
            onMouseUp={(e) => { e.preventDefault(); handleVirtualKey("ArrowUp", false) }}
            onMouseLeave={(e) => { e.preventDefault(); handleVirtualKey("ArrowUp", false) }}
            onTouchStart={(e) => { e.preventDefault(); handleVirtualKey("ArrowUp", true) }}
            onTouchEnd={(e) => { e.preventDefault(); handleVirtualKey("ArrowUp", false) }}
            onTouchCancel={(e) => { e.preventDefault(); handleVirtualKey("ArrowUp", false) }}
          >
            UP
          </button>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="w-12 h-12 rounded bg-black/70 text-xs font-mono text-white border border-white/60"
              onMouseDown={(e) => { e.preventDefault(); handleVirtualKey("ArrowLeft", true) }}
              onMouseUp={(e) => { e.preventDefault(); handleVirtualKey("ArrowLeft", false) }}
              onMouseLeave={(e) => { e.preventDefault(); handleVirtualKey("ArrowLeft", false) }}
              onTouchStart={(e) => { e.preventDefault(); handleVirtualKey("ArrowLeft", true) }}
              onTouchEnd={(e) => { e.preventDefault(); handleVirtualKey("ArrowLeft", false) }}
              onTouchCancel={(e) => { e.preventDefault(); handleVirtualKey("ArrowLeft", false) }}
            >
              LEFT
            </button>
            <button
              type="button"
              className="w-12 h-12 rounded bg-black/70 text-xs font-mono text-white border border-white/60"
              onMouseDown={(e) => { e.preventDefault(); handleVirtualKey("ArrowDown", true) }}
              onMouseUp={(e) => { e.preventDefault(); handleVirtualKey("ArrowDown", false) }}
              onMouseLeave={(e) => { e.preventDefault(); handleVirtualKey("ArrowDown", false) }}
              onTouchStart={(e) => { e.preventDefault(); handleVirtualKey("ArrowDown", true) }}
              onTouchEnd={(e) => { e.preventDefault(); handleVirtualKey("ArrowDown", false) }}
              onTouchCancel={(e) => { e.preventDefault(); handleVirtualKey("ArrowDown", false) }}
            >
              DOWN
            </button>
            <button
              type="button"
              className="w-12 h-12 rounded bg-black/70 text-xs font-mono text-white border border-white/60"
              onMouseDown={(e) => { e.preventDefault(); handleVirtualKey("ArrowRight", true) }}
              onMouseUp={(e) => { e.preventDefault(); handleVirtualKey("ArrowRight", false) }}
              onMouseLeave={(e) => { e.preventDefault(); handleVirtualKey("ArrowRight", false) }}
              onTouchStart={(e) => { e.preventDefault(); handleVirtualKey("ArrowRight", true) }}
              onTouchEnd={(e) => { e.preventDefault(); handleVirtualKey("ArrowRight", false) }}
              onTouchCancel={(e) => { e.preventDefault(); handleVirtualKey("ArrowRight", false) }}
            >
              RIGHT
            </button>
          </div>
        </div>
      )}
      
      {/* Night overlay - covers the entire world */}
      <div 
        className="absolute inset-0 pointer-events-none z-[500] transition-opacity duration-1000"
        style={{
          backgroundColor: getNightTint(timeOfDay),
          opacity: getNightOverlayOpacity(timeOfDay) > 0 ? 1 : 0
        }}
      />
      
      {/* Pixel art border frame */}
      <div 
        className="absolute inset-0 pointer-events-none z-[999]"
        style={{
          border: "6px solid #2D2D2D",
          boxShadow: "inset 0 0 0 3px #4A4A4A"
        }}
      />
    </div>
  )
}

function Tile({ type, x, y, isRustling, isNight }: { type: TileType; x: number; y: number; isRustling?: boolean; isNight?: boolean }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: x * TILE_SIZE,
    top: y * TILE_SIZE,
    width: TILE_SIZE,
    height: TILE_SIZE,
    imageRendering: "pixelated"
  }
  
  switch (type) {
    case TILE.GRASS:
      return <GrassTile style={style} variant={(x + y) % 3} />
    case TILE.PATH:
      return <PathTile style={style} />
    case TILE.WATER:
      return <WaterTile style={style} />
    case TILE.FLOWER_RED:
      return <FlowerTile style={style} color="#E63946" />
    case TILE.FLOWER_YELLOW:
      return <FlowerTile style={style} color="#FFE066" />
    case TILE.TREE:
      return <TreeTile style={style} x={x} y={y} />
    case TILE.HOUSE_1:
      return <HouseTile style={style} x={x} y={y} color="#C75B39" roofColor="#8B4513" isNight={isNight} />
    case TILE.HOUSE_2:
      return <HouseTile style={style} x={x} y={y} color="#4A7C99" roofColor="#2D5A7B" isNight={isNight} />
    case TILE.HOUSE_3:
      return <HouseTile style={style} x={x} y={y} color="#7B9E6B" roofColor="#4A6B3A" isNight={isNight} />
    case TILE.FENCE:
      return <FenceTile style={style} />
    case TILE.SIGN:
      return <SignTile style={style} />
    case TILE.WELL:
      return <WellTile style={style} />
    case TILE.TALL_GRASS:
      return <TallGrassTile style={style} isRustling={isRustling} />
    case TILE.CAMPFIRE:
      return <CampfireTile style={style} isNight={isNight} />
    default:
      return <GrassTile style={style} variant={0} />
  }
}

function GrassTile({ style, variant }: { style: React.CSSProperties; variant: number }) {
  return (
    <div style={{ ...style, backgroundColor: "#5AAF3A" }}>
      {/* Grass texture */}
      {variant === 0 && (
        <>
          <div className="absolute" style={{ width: 2, height: 6, backgroundColor: "#4A9B2E", left: 8, top: 20, borderRadius: 1 }} />
          <div className="absolute" style={{ width: 2, height: 5, backgroundColor: "#6BC94A", left: 30, top: 12, borderRadius: 1 }} />
        </>
      )}
      {variant === 1 && (
        <>
          <div className="absolute" style={{ width: 2, height: 5, backgroundColor: "#4A9B2E", left: 18, top: 8, borderRadius: 1 }} />
          <div className="absolute" style={{ width: 2, height: 6, backgroundColor: "#6BC94A", left: 36, top: 28, borderRadius: 1 }} />
        </>
      )}
      {variant === 2 && (
        <>
          <div className="absolute" style={{ width: 2, height: 4, backgroundColor: "#6BC94A", left: 12, top: 32, borderRadius: 1 }} />
          <div className="absolute" style={{ width: 2, height: 5, backgroundColor: "#4A9B2E", left: 28, top: 6, borderRadius: 1 }} />
        </>
      )}
    </div>
  )
}

function TallGrassTile({ style, isRustling }: { style: React.CSSProperties; isRustling?: boolean }) {
  return (
    <div style={{ ...style, backgroundColor: "#4A9B2E", overflow: "hidden" }}>
      {/* Dense tall grass blades */}
      <div 
        className="absolute"
        style={{ 
          width: "100%", 
          height: "100%",
          animation: isRustling ? "rustleGrass 0.4s ease-out" : "none",
          transformOrigin: "bottom center"
        }}
      >
        {/* Back row of grass (darker) */}
        <div className="absolute" style={{ width: 4, height: 20, backgroundColor: "#2D7A1E", left: 2, top: 8, borderRadius: "2px 2px 0 0", transform: "skewX(-5deg)" }} />
        <div className="absolute" style={{ width: 4, height: 22, backgroundColor: "#2D7A1E", left: 10, top: 6, borderRadius: "2px 2px 0 0", transform: "skewX(3deg)" }} />
        <div className="absolute" style={{ width: 4, height: 18, backgroundColor: "#2D7A1E", left: 18, top: 10, borderRadius: "2px 2px 0 0", transform: "skewX(-4deg)" }} />
        <div className="absolute" style={{ width: 4, height: 21, backgroundColor: "#2D7A1E", left: 26, top: 7, borderRadius: "2px 2px 0 0", transform: "skewX(5deg)" }} />
        <div className="absolute" style={{ width: 4, height: 19, backgroundColor: "#2D7A1E", left: 34, top: 9, borderRadius: "2px 2px 0 0", transform: "skewX(-3deg)" }} />
        <div className="absolute" style={{ width: 4, height: 20, backgroundColor: "#2D7A1E", left: 42, top: 8, borderRadius: "2px 2px 0 0", transform: "skewX(4deg)" }} />
        
        {/* Front row of grass (lighter) */}
        <div className="absolute" style={{ width: 5, height: 24, backgroundColor: "#3D8B2C", left: 4, top: 12, borderRadius: "2px 2px 0 0", transform: "skewX(4deg)" }} />
        <div className="absolute" style={{ width: 5, height: 26, backgroundColor: "#4A9B35", left: 14, top: 10, borderRadius: "2px 2px 0 0", transform: "skewX(-5deg)" }} />
        <div className="absolute" style={{ width: 5, height: 22, backgroundColor: "#3D8B2C", left: 22, top: 14, borderRadius: "2px 2px 0 0", transform: "skewX(3deg)" }} />
        <div className="absolute" style={{ width: 5, height: 25, backgroundColor: "#4A9B35", left: 30, top: 11, borderRadius: "2px 2px 0 0", transform: "skewX(-4deg)" }} />
        <div className="absolute" style={{ width: 5, height: 23, backgroundColor: "#3D8B2C", left: 38, top: 13, borderRadius: "2px 2px 0 0", transform: "skewX(5deg)" }} />
        
        {/* Highlight blades */}
        <div className="absolute" style={{ width: 3, height: 18, backgroundColor: "#5AAF3A", left: 8, top: 16, borderRadius: "1px 1px 0 0", transform: "skewX(-6deg)" }} />
        <div className="absolute" style={{ width: 3, height: 20, backgroundColor: "#5AAF3A", left: 28, top: 14, borderRadius: "1px 1px 0 0", transform: "skewX(6deg)" }} />
      </div>
      
      {/* CSS Animation */}
      <style jsx>{`
        @keyframes rustleGrass {
          0% { transform: skewX(0deg); }
          20% { transform: skewX(12deg); }
          40% { transform: skewX(-8deg); }
          60% { transform: skewX(5deg); }
          80% { transform: skewX(-3deg); }
          100% { transform: skewX(0deg); }
        }
      `}</style>
    </div>
  )
}

function PathTile({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ ...style, backgroundColor: "#C4A86C" }}>
      {/* Path texture - cobblestone look */}
      <div className="absolute" style={{ width: 8, height: 6, backgroundColor: "#B09858", left: 4, top: 4, borderRadius: 2 }} />
      <div className="absolute" style={{ width: 10, height: 7, backgroundColor: "#A68B4B", left: 20, top: 8, borderRadius: 2 }} />
      <div className="absolute" style={{ width: 7, height: 5, backgroundColor: "#B09858", left: 36, top: 4, borderRadius: 2 }} />
      <div className="absolute" style={{ width: 9, height: 6, backgroundColor: "#A68B4B", left: 8, top: 22, borderRadius: 2 }} />
      <div className="absolute" style={{ width: 8, height: 7, backgroundColor: "#B09858", left: 26, top: 28, borderRadius: 2 }} />
      <div className="absolute" style={{ width: 6, height: 5, backgroundColor: "#A68B4B", left: 38, top: 36, borderRadius: 2 }} />
      <div className="absolute" style={{ width: 7, height: 6, backgroundColor: "#B09858", left: 4, top: 38, borderRadius: 2 }} />
    </div>
  )
}

function WaterTile({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ ...style, backgroundColor: "#4A90C2" }}>
      <div className="absolute" style={{ width: "100%", height: 4, backgroundColor: "#5BA0D2", top: 8 }} />
      <div className="absolute" style={{ width: "100%", height: 3, backgroundColor: "#6BB0E2", top: 24 }} />
      <div className="absolute" style={{ width: "100%", height: 4, backgroundColor: "#5BA0D2", top: 38 }} />
    </div>
  )
}

function FlowerTile({ style, color }: { style: React.CSSProperties; color: string }) {
  return (
    <div style={{ ...style, backgroundColor: "#5AAF3A" }}>
      {/* Stem */}
      <div className="absolute" style={{ width: 2, height: 12, backgroundColor: "#3D8B2C", left: 23, top: 24 }} />
      {/* Flower petals */}
      <div className="absolute" style={{ width: 8, height: 8, backgroundColor: color, left: 20, top: 14, borderRadius: "50%" }} />
      <div className="absolute" style={{ width: 8, height: 8, backgroundColor: color, left: 16, top: 18, borderRadius: "50%" }} />
      <div className="absolute" style={{ width: 8, height: 8, backgroundColor: color, left: 24, top: 18, borderRadius: "50%" }} />
      <div className="absolute" style={{ width: 6, height: 6, backgroundColor: "#FFE066", left: 21, top: 18, borderRadius: "50%" }} />
      {/* Grass */}
      <div className="absolute" style={{ width: 2, height: 5, backgroundColor: "#4A9B2E", left: 8, top: 32, borderRadius: 1 }} />
      <div className="absolute" style={{ width: 2, height: 4, backgroundColor: "#6BC94A", left: 36, top: 28, borderRadius: 1 }} />
    </div>
  )
}

function TreeTile({ style, x, y }: { style: React.CSSProperties; x: number; y: number }) {
  return (
    <div style={{ ...style, backgroundColor: "#5AAF3A", zIndex: y * 10 + 100 }}>
      {/* Trunk */}
      <div className="absolute" style={{ 
        width: 12, 
        height: 20, 
        backgroundColor: "#654321", 
        left: 18, 
        top: 28,
        border: "2px solid #4A3728"
      }} />
      {/* Foliage - layered circles for 16-bit look */}
      <div className="absolute" style={{ 
        width: 40, 
        height: 32, 
        backgroundColor: "#228B22", 
        left: 4, 
        top: 0,
        borderRadius: "50%",
        border: "3px solid #1A6B1A"
      }} />
      <div className="absolute" style={{ 
        width: 32, 
        height: 28, 
        backgroundColor: "#2E9B2E", 
        left: 8, 
        top: -8,
        borderRadius: "50%"
      }} />
      <div className="absolute" style={{ 
        width: 24, 
        height: 20, 
        backgroundColor: "#3AAB3A", 
        left: 12, 
        top: -4,
        borderRadius: "50%"
      }} />
    </div>
  )
}

function HouseTile({ style, x, y, color, roofColor, isNight }: { style: React.CSSProperties; x: number; y: number; color: string; roofColor: string; isNight?: boolean }) {
  // Check if this is part of a larger house structure
  const map = TOWN_MAP
  const isTopLeft = map[y]?.[x+1] === map[y][x] && map[y+1]?.[x] === map[y][x]
  const isTopRight = map[y]?.[x-1] === map[y][x] && map[y+1]?.[x] === map[y][x]
  const isBottomLeft = map[y]?.[x+1] === map[y][x] && map[y-1]?.[x] === map[y][x]
  const isBottomRight = map[y]?.[x-1] === map[y][x] && map[y-1]?.[x] === map[y][x]
  
  // Window colors - warm glow at night
  const windowColor = isNight ? "#FFE4A0" : "#87CEEB"
  const windowGlow = isNight ? "0 0 12px 4px rgba(255, 220, 120, 0.6)" : "none"
  
  // Only render full house on top-left tile of 2x2 block
  if (!isTopLeft) {
    return <div style={{ ...style, backgroundColor: "#5AAF3A" }} />
  }
  
  return (
    <div style={{ ...style, backgroundColor: "#5AAF3A", zIndex: y * 10 + 100, overflow: "visible" }}>
      {/* House body - spans 2x2 tiles */}
      <div className="absolute" style={{
        width: TILE_SIZE * 2 - 8,
        height: TILE_SIZE + 20,
        backgroundColor: color,
        left: 4,
        top: TILE_SIZE - 24,
        border: "3px solid #1A1A2E"
      }}>
        {/* Door */}
        <div className="absolute" style={{
          width: 18,
          height: 28,
          backgroundColor: "#654321",
          left: "50%",
          bottom: 0,
          transform: "translateX(-50%)",
          border: "2px solid #4A3728"
        }}>
          {/* Door knob */}
          <div className="absolute" style={{
            width: 4,
            height: 4,
            backgroundColor: "#FFD700",
            right: 3,
            top: "50%",
            borderRadius: "50%"
          }} />
        </div>
        {/* Windows - glow at night */}
        <div className="absolute" style={{
          width: 16,
          height: 16,
          backgroundColor: windowColor,
          left: 10,
          top: 12,
          border: "2px solid #1A1A2E",
          boxShadow: windowGlow,
          transition: "background-color 1s, box-shadow 1s"
        }}>
          <div className="absolute" style={{ width: 1, height: "100%", backgroundColor: "#1A1A2E", left: "50%" }} />
          <div className="absolute" style={{ width: "100%", height: 1, backgroundColor: "#1A1A2E", top: "50%" }} />
        </div>
        <div className="absolute" style={{
          width: 16,
          height: 16,
          backgroundColor: windowColor,
          right: 10,
          top: 12,
          border: "2px solid #1A1A2E",
          boxShadow: windowGlow,
          transition: "background-color 1s, box-shadow 1s"
        }}>
          <div className="absolute" style={{ width: 1, height: "100%", backgroundColor: "#1A1A2E", left: "50%" }} />
          <div className="absolute" style={{ width: "100%", height: 1, backgroundColor: "#1A1A2E", top: "50%" }} />
        </div>
      </div>
      {/* Roof */}
      <div className="absolute" style={{
        width: 0,
        height: 0,
        borderLeft: `${TILE_SIZE - 2}px solid transparent`,
        borderRight: `${TILE_SIZE - 2}px solid transparent`,
        borderBottom: `${TILE_SIZE - 10}px solid ${roofColor}`,
        left: 2,
        top: -6
      }} />
      {/* Roof outline */}
      <div className="absolute" style={{
        width: TILE_SIZE * 2 - 4,
        height: 4,
        backgroundColor: roofColor,
        left: 2,
        top: TILE_SIZE - 30,
        borderBottom: "2px solid #1A1A2E"
      }} />
    </div>
  )
}

function FenceTile({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ ...style, backgroundColor: "#5AAF3A" }}>
      {/* Fence posts and rails */}
      <div className="absolute" style={{ width: 6, height: 28, backgroundColor: "#8B7355", left: 4, top: 10, border: "1px solid #654321" }} />
      <div className="absolute" style={{ width: 6, height: 28, backgroundColor: "#8B7355", left: 38, top: 10, border: "1px solid #654321" }} />
      <div className="absolute" style={{ width: "100%", height: 5, backgroundColor: "#A68B4B", left: 0, top: 14, border: "1px solid #654321" }} />
      <div className="absolute" style={{ width: "100%", height: 5, backgroundColor: "#A68B4B", left: 0, top: 28, border: "1px solid #654321" }} />
    </div>
  )
}

function SignTile({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ ...style, backgroundColor: "#5AAF3A" }}>
      {/* Post */}
      <div className="absolute" style={{ width: 6, height: 24, backgroundColor: "#654321", left: 21, top: 24, border: "1px solid #4A3728" }} />
      {/* Sign board */}
      <div className="absolute" style={{ 
        width: 32, 
        height: 20, 
        backgroundColor: "#C4A86C", 
        left: 8, 
        top: 6,
        border: "2px solid #8B7355",
        borderRadius: 2
      }}>
        {/* Text lines */}
        <div className="absolute" style={{ width: 20, height: 2, backgroundColor: "#654321", left: 4, top: 5 }} />
        <div className="absolute" style={{ width: 16, height: 2, backgroundColor: "#654321", left: 4, top: 10 }} />
      </div>
    </div>
  )
}

function WellTile({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ ...style, backgroundColor: "#C4A86C", zIndex: 200 }}>
      {/* Well base - stone circle */}
      <div className="absolute" style={{ 
        width: 36, 
        height: 36, 
        backgroundColor: "#808080", 
        left: 6, 
        top: 6,
        borderRadius: "50%",
        border: "4px solid #606060"
      }}>
        {/* Water inside */}
        <div className="absolute" style={{ 
          width: 20, 
          height: 20, 
          backgroundColor: "#4A90C2", 
          left: 4, 
          top: 4,
          borderRadius: "50%"
        }} />
      </div>
      {/* Roof supports */}
      <div className="absolute" style={{ width: 4, height: 20, backgroundColor: "#654321", left: 8, top: -14 }} />
      <div className="absolute" style={{ width: 4, height: 20, backgroundColor: "#654321", left: 36, top: -14 }} />
      {/* Roof */}
      <div className="absolute" style={{ 
        width: 40, 
        height: 8, 
        backgroundColor: "#8B4513", 
        left: 4, 
        top: -18,
        borderRadius: 2
      }} />
    </div>
  )
}

function CampfireTile({ style, isNight }: { style: React.CSSProperties; isNight?: boolean }) {
  return (
    <div style={{ ...style, backgroundColor: "#5AAF3A", overflow: "visible", zIndex: 150 }}>
      {/* Stone circle base */}
      <div className="absolute" style={{
        width: 32,
        height: 16,
        backgroundColor: "#606060",
        left: 8,
        top: 28,
        borderRadius: "50%",
        border: "2px solid #404040"
      }} />
      
      {/* Logs */}
      <div className="absolute" style={{
        width: 24,
        height: 6,
        backgroundColor: "#654321",
        left: 12,
        top: 30,
        borderRadius: 2,
        transform: "rotate(-15deg)",
        border: "1px solid #4A3728"
      }} />
      <div className="absolute" style={{
        width: 24,
        height: 6,
        backgroundColor: "#5C3A1D",
        left: 12,
        top: 28,
        borderRadius: 2,
        transform: "rotate(15deg)",
        border: "1px solid #4A3728"
      }} />
      
      {/* Fire glow (larger at night) */}
      <div 
        className="absolute"
        style={{
          width: 40,
          height: 40,
          background: "radial-gradient(circle, rgba(255,150,50,0.4) 0%, rgba(255,100,0,0.2) 40%, transparent 70%)",
          left: 4,
          top: 4,
          borderRadius: "50%",
          opacity: isNight ? 1 : 0.5,
          transition: "opacity 1s"
        }}
      />
      
      {/* Flames - animated */}
      <div className="absolute" style={{ left: 14, top: 8, width: 20, height: 24 }}>
        {/* Main flame */}
        <div 
          className="absolute"
          style={{
            width: 12,
            height: 20,
            background: "linear-gradient(to top, #FF4500 0%, #FF6B00 40%, #FFD700 80%, #FFFF00 100%)",
            left: 4,
            bottom: 0,
            borderRadius: "50% 50% 20% 20%",
            animation: "flicker 0.5s ease-in-out infinite alternate",
            boxShadow: isNight ? "0 0 15px 5px rgba(255,100,0,0.6)" : "0 0 8px 2px rgba(255,100,0,0.3)"
          }}
        />
        {/* Left flame */}
        <div 
          className="absolute"
          style={{
            width: 8,
            height: 14,
            background: "linear-gradient(to top, #FF6B00 0%, #FFD700 60%, #FFFF00 100%)",
            left: 0,
            bottom: 2,
            borderRadius: "50% 50% 20% 20%",
            animation: "flicker 0.4s ease-in-out infinite alternate-reverse"
          }}
        />
        {/* Right flame */}
        <div 
          className="absolute"
          style={{
            width: 8,
            height: 16,
            background: "linear-gradient(to top, #FF6B00 0%, #FFD700 60%, #FFFF00 100%)",
            right: 0,
            bottom: 1,
            borderRadius: "50% 50% 20% 20%",
            animation: "flicker 0.6s ease-in-out infinite alternate"
          }}
        />
      </div>
      
      {/* Sparks at night */}
      {isNight && (
        <>
          <div 
            className="absolute"
            style={{
              width: 3,
              height: 3,
              backgroundColor: "#FFD700",
              left: 20,
              top: 2,
              borderRadius: "50%",
              animation: "sparkle 1s ease-out infinite"
            }}
          />
          <div 
            className="absolute"
            style={{
              width: 2,
              height: 2,
              backgroundColor: "#FFA500",
              left: 28,
              top: 6,
              borderRadius: "50%",
              animation: "sparkle 1.2s ease-out infinite 0.3s"
            }}
          />
          <div 
            className="absolute"
            style={{
              width: 2,
              height: 2,
              backgroundColor: "#FF6B00",
              left: 16,
              top: 4,
              borderRadius: "50%",
              animation: "sparkle 0.9s ease-out infinite 0.6s"
            }}
          />
        </>
      )}
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes flicker {
          0% { transform: scaleY(1) scaleX(1); opacity: 1; }
          50% { transform: scaleY(1.1) scaleX(0.9); opacity: 0.9; }
          100% { transform: scaleY(0.95) scaleX(1.05); opacity: 1; }
        }
        @keyframes sparkle {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-15px) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
