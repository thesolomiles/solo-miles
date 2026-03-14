"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
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
  HOUSE_DOOR: 14,
} as const

type TileType = typeof TILE[keyof typeof TILE]

// Interior tile types (separate map system)
const INTERIOR = {
  FLOOR: 0,
  WALL: 1,
  DOOR_EXIT: 2,
  FURNITURE: 3,
} as const

type InteriorTileType = typeof INTERIOR[keyof typeof INTERIOR]

// Tile size in pixels
const TILE_SIZE = 48

// Map id type for transitions (extend with more interiors later)
type MapId = "overworld" | "house_interior"

// Trigger system: reusable event layer for dialogue, transitions, etc.
type TriggerType = "dialogue" | "transition"

interface BaseTrigger {
  type: TriggerType
  x: number
  y: number
  width?: number
  height?: number
  facingRequired?: Direction
}

interface DialogueTrigger extends BaseTrigger {
  type: "dialogue"
  dialogue: string[]
}

// Portfolio section that a house interior can represent (plug in real content later)
export type SectionId = "about" | "projects" | "contact"

const SECTION_LABELS: Record<SectionId, string> = {
  about: "About",
  projects: "Projects",
  contact: "Contact",
}

interface TransitionTrigger extends BaseTrigger {
  type: "transition"
  targetMap: MapId
  /** When targetMap is house_interior, which portfolio section this house represents */
  section?: SectionId
}

type Trigger = DialogueTrigger | TransitionTrigger

export interface Npc {
  id: string
  x: number
  y: number
  spriteType?: string
  dialogue: string[]
}

function triggerContains(trigger: Trigger, tileX: number, tileY: number): boolean {
  const w = trigger.width ?? 1
  const h = trigger.height ?? 1
  return tileX >= trigger.x && tileX < trigger.x + w && tileY >= trigger.y && tileY < trigger.y + h
}

interface MapEntry {
  id: MapId
  width: number
  height: number
  tiles: number[][]
  collisionTiles: readonly number[]
  triggers: Trigger[]
  npcs?: Npc[]
  label?: string
}

// Overworld collision (HOUSE_DOOR is walkable to allow entry)
const OVERWORLD_COLLISION: readonly number[] = [TILE.WATER, TILE.TREE, TILE.HOUSE_1, TILE.HOUSE_2, TILE.HOUSE_3, TILE.FENCE, TILE.WELL]

// Overworld: Village (bottom) → Bridge → Forest Road → Forest End (top). 36×30 tiles.
const OVERWORLD_TILES: TileType[][] = [
  // Rows 0–1: Forest End – clearing with sign, trees around
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 1, 0, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 1, 1, 1, 0, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  // Rows 2–9: Forest Road – dirt path center; sign (left) and konbini (right) by the road, trees cleared for access
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 1, 1, 1, 1, 1, 7, 7, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 7, 7, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 5, 1, 1, 1, 1, 0, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 10, 1, 1, 1, 1, 1, 1, 7, 14, 5, 5, 5, 5, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 5, 1, 1, 1, 1, 1, 7, 5, 5, 5, 5, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  // Row 10: River (full width), bridge center (only crossing)
  [5, 5, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5],
  // Rows 11–29: Village – dirt path north from center, 6 house plots (2×2 each)
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 14, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 14, 0, 0, 0, 5],
  [5, 0, 0, 0, 1, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 6, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 14, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 14, 0, 0, 0, 5],
  [5, 0, 0, 0, 1, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 14, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 14, 0, 0, 0, 5],
  [5, 0, 0, 0, 1, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 8, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
]

// House interior: single reusable map (10x8), door at center bottom
const INTERIOR_TILES: InteriorTileType[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 3, 0, 0, 3, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 2, 2, 1, 1, 1, 1],
]
const INTERIOR_COLLISION: readonly number[] = [INTERIOR.WALL, INTERIOR.FURNITURE]

// Trigger definitions per map (dialogue + transition)
const OVERWORLD_TRIGGERS: Trigger[] = [
  { type: "dialogue", x: 14, y: 0, width: 4, height: 2, dialogue: ["It's a long road ahead."] },
  { type: "dialogue", x: 12, y: 5, dialogue: ["Vending machines. Out of order."] },
  { type: "dialogue", x: 19, y: 6, dialogue: ["Konbini. Open 24/7."] },
  { type: "transition", x: 4, y: 12, targetMap: "house_interior", section: "about" },
  { type: "transition", x: 30, y: 12, targetMap: "house_interior", section: "projects" },
  { type: "transition", x: 4, y: 16, targetMap: "house_interior", section: "contact" },
  { type: "transition", x: 30, y: 16, targetMap: "house_interior", section: "about" },
  { type: "transition", x: 4, y: 20, targetMap: "house_interior", section: "about" },
  { type: "transition", x: 30, y: 20, targetMap: "house_interior", section: "about" },
]
const INTERIOR_TRIGGERS: Trigger[] = [
  { type: "transition", x: 4, y: 7, width: 2, height: 1, targetMap: "overworld" },
]

const OVERWORLD_NPCS: Npc[] = [
  {
    id: "villager_1",
    x: 19,
    y: 24,
    dialogue: [
      "Hello there.",
      "This is the village. Cross the bridge to reach the forest road.",
    ],
  },
]

// Map registry: all maps in one place (extend with more overworld areas or interiors)
const MAP_REGISTRY: Record<MapId, MapEntry> = {
  overworld: {
    id: "overworld",
    width: 36,
    height: 30,
    tiles: OVERWORLD_TILES as number[][],
    collisionTiles: OVERWORLD_COLLISION,
    triggers: OVERWORLD_TRIGGERS,
    npcs: OVERWORLD_NPCS,
  },
  house_interior: {
    id: "house_interior",
    width: 10,
    height: 8,
    tiles: INTERIOR_TILES as number[][],
    collisionTiles: INTERIOR_COLLISION,
    triggers: INTERIOR_TRIGGERS,
    npcs: [],
    label: "House",
  },
}

const TRANSITION_DURATION_MS = 280

export function GameWorld() {
  // Position in pixels (spawn near village center)
  const [position, setPosition] = useState({
    x: 17 * TILE_SIZE + TILE_SIZE / 2 - 32,
    y: 24 * TILE_SIZE + TILE_SIZE - 72,
  })
  const [direction, setDirection] = useState<Direction>("down")
  const [isWalking, setIsWalking] = useState(false)
  const [walkFrame, setWalkFrame] = useState(0)
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 640 })
  const [rustlingTiles, setRustlingTiles] = useState<Set<string>>(new Set())
  const [dialogueState, setDialogueState] = useState<{ lines: string[]; index: number } | null>(null)
  const dialogueOpen = dialogueState !== null
  const currentDialogueLine = dialogueState?.lines[dialogueState.index] ?? null
  const [currentMapId, setCurrentMapId] = useState<MapId>("overworld")
  const [exitPosition, setExitPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [transitionOpacity, setTransitionOpacity] = useState(0)
  const [currentHouseSection, setCurrentHouseSection] = useState<SectionId | null>(null)
  const transitionIntentRef = useRef<"enter_house" | "exit_house" | null>(null)
  const pendingHouseSectionRef = useRef<SectionId>("about")
  const lastDoorTileRef = useRef<{ tileX: number; tileY: number } | null>(null)
  const wasOnInteriorExitRef = useRef(false)
  const forestEndModalShownRef = useRef(false)
  const keysPressed = useRef<Set<string>>(new Set())
  const animationRef = useRef<number | null>(null)
  const lastFrameTime = useRef<number>(0)
  const walkFrameTimeRef = useRef<number>(0)
  const [areaLabelText, setAreaLabelText] = useState("")
  const [areaLabelOpacity, setAreaLabelOpacity] = useState(0)
  const lastAreaRef = useRef<string>("")
  
  const isMobile = viewportSize.width < 768
  const BASE_MOVE_SPEED = 3
  const MAX_MOBILE_MOVE_SPEED = 3
  const mobileMoveSpeed = useRef<number>(BASE_MOVE_SPEED)
  const mobileThumbstickRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const mobileZigzagPhaseRef = useRef(0)
  // Movement: speed units per second (3 ≈ 180 px/s so ~3 px/frame at 60fps)
  const PIXELS_PER_SECOND_PER_SPEED = 60
  const WALK_FRAME_INTERVAL_MS = 120
  const CAMERA_SMOOTHNESS = 0.08 // Lower = smoother, higher = snappier
  
  // Player sprite size (pixel-character is 16*4 x 18*4)
  const SPRITE_WIDTH = 64
  const SPRITE_HEIGHT = 72
  // Rectangular collision hitbox (centered under sprite, at feet)
  const HITBOX_WIDTH = 24
  const HITBOX_HEIGHT = 28
  const HITBOX_OFFSET_X = (SPRITE_WIDTH - HITBOX_WIDTH) / 2
  const HITBOX_OFFSET_Y = SPRITE_HEIGHT - HITBOX_HEIGHT

  const currentMapData = useMemo(() => {
    const map = MAP_REGISTRY[currentMapId]
    return {
      tiles: map.tiles,
      width: map.width,
      height: map.height,
      isSolid: (t: number) => map.collisionTiles.includes(t),
      mapId: map.id,
      label: map.label,
      triggers: map.triggers,
      npcs: map.npcs ?? [],
    }
  }, [currentMapId])

  const handleVirtualKey = useCallback((key: string, isDown: boolean) => {
    if (isDown) {
      keysPressed.current.add(key)
    } else {
      keysPressed.current.delete(key)
    }
  }, [])
  
  const canMoveTo = useCallback(
    (newX: number, newY: number) => {
      const { tiles, width, height, isSolid, npcs } = currentMapData
      const left = newX + HITBOX_OFFSET_X
      const top = newY + HITBOX_OFFSET_Y
      const right = left + HITBOX_WIDTH
      const bottom = top + HITBOX_HEIGHT
      const mapRight = width * TILE_SIZE
      const mapBottom = height * TILE_SIZE

      if (left < 0 || top < 0 || right > mapRight || bottom > mapBottom) {
        return false
      }

      const corners = [
        { x: left, y: top },
        { x: right, y: top },
        { x: left, y: bottom },
        { x: right, y: bottom },
      ]

      for (const point of corners) {
        const tileX = Math.floor(point.x / TILE_SIZE)
        const tileY = Math.floor(point.y / TILE_SIZE)

        if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) {
          return false
        }

        const tile = tiles[tileY][tileX]

        // Treat all tiles in a small neighborhood around any door tile as non-solid,
        // so the player can move freely right up to and around doors.
        if (isSolid(tile)) {
          let nearDoor = false
          for (let dy = -1; dy <= 1 && !nearDoor; dy++) {
            const ny = tileY + dy
            if (ny < 0 || ny >= height) continue
            for (let dx = -1; dx <= 1; dx++) {
              const nx = tileX + dx
              if (nx < 0 || nx >= width) continue
              if (tiles[ny][nx] === TILE.HOUSE_DOOR) {
                nearDoor = true
                break
              }
            }
          }
          if (!nearDoor) {
            return false
          }
        }

        if (npcs.some((npc) => npc.x === tileX && npc.y === tileY)) {
          return false
        }
      }

      return true
    },
    [currentMapData],
  )

  const getTriggerInFront = useCallback(
    (pos: { x: number; y: number }, dir: Direction): Trigger | null => {
      const { width, height, triggers } = currentMapData
      const left = pos.x + HITBOX_OFFSET_X
      const top = pos.y + HITBOX_OFFSET_Y
      const right = left + HITBOX_WIDTH
      const bottom = top + HITBOX_HEIGHT
      const centerX = left + HITBOX_WIDTH / 2
      const centerY = top + HITBOX_HEIGHT / 2

      const probePoints: Array<{ x: number; y: number }> = []
      switch (dir) {
        case "up":
          probePoints.push(
            { x: left, y: top - 1 },
            { x: centerX, y: top - 1 },
            { x: right, y: top - 1 },
          )
          break
        case "down":
          probePoints.push(
            { x: left, y: bottom + 1 },
            { x: centerX, y: bottom + 1 },
            { x: right, y: bottom + 1 },
          )
          break
        case "left":
          probePoints.push(
            { x: left - 1, y: top },
            { x: left - 1, y: centerY },
            { x: left - 1, y: bottom },
          )
          break
        case "right":
          probePoints.push(
            { x: right + 1, y: top },
            { x: right + 1, y: centerY },
            { x: right + 1, y: bottom },
          )
          break
      }

      for (const { x, y } of probePoints) {
        const tileX = Math.floor(x / TILE_SIZE)
        const tileY = Math.floor(y / TILE_SIZE)
        if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) continue
        for (const trigger of triggers) {
          if (!triggerContains(trigger, tileX, tileY)) continue
          if (trigger.facingRequired != null && trigger.facingRequired !== dir) continue
          if (trigger.type === "dialogue") return trigger
          if (trigger.type === "transition") return trigger
        }
        const npc = currentMapData.npcs.find((n) => n.x === tileX && n.y === tileY)
        if (npc != null) {
          return { type: "dialogue", x: tileX, y: tileY, dialogue: npc.dialogue } satisfies DialogueTrigger
        }
      }
      return null
    },
    [currentMapData, currentMapId],
  )

  const handleInteract = useCallback(() => {
    if (dialogueOpen) return
    const trigger = getTriggerInFront(position, direction)
    if (trigger == null) return
    if (trigger.type === "dialogue" && trigger.dialogue.length > 0) {
      setDialogueState({ lines: trigger.dialogue, index: 0 })
      return
    }
    if (trigger.type === "transition") {
      if (trigger.targetMap === "house_interior") {
        lastDoorTileRef.current = { tileX: trigger.x, tileY: trigger.y }
        pendingHouseSectionRef.current = trigger.section ?? "about"
        setExitPosition({
          x: trigger.x * TILE_SIZE + TILE_SIZE / 2 - SPRITE_WIDTH / 2,
          y: (trigger.y + 1) * TILE_SIZE - HITBOX_OFFSET_Y,
        })
        transitionIntentRef.current = "enter_house"
      } else {
        transitionIntentRef.current = "exit_house"
      }
      setTransitionOpacity(1)
    }
  }, [dialogueOpen, position, direction, getTriggerInFront])

  const getTransitionTriggerAt = useCallback(
    (tileX: number, tileY: number): TransitionTrigger | null => {
      for (const t of currentMapData.triggers) {
        if (t.type === "transition" && triggerContains(t, tileX, tileY)) return t
      }
      return null
    },
    [currentMapData.triggers],
  )

  const closeDialogue = useCallback(() => {
    setDialogueState(null)
  }, [])

  const advanceDialogue = useCallback(() => {
    setDialogueState(prev => {
      if (prev == null) return null
      if (prev.index + 1 < prev.lines.length) {
        return { ...prev, index: prev.index + 1 }
      }
      return null
    })
  }, [])

  const isInteractableInFront = useMemo(
    () => getTriggerInFront(position, direction) != null,
    [position, direction, getTriggerInFront],
  )

  const onInteractAction = useCallback(() => {
    if (dialogueOpen) advanceDialogue()
    else handleInteract()
  }, [dialogueOpen, advanceDialogue, handleInteract])

  const updateMovement = useCallback((timestamp: number) => {
    const prevTime = lastFrameTime.current
    lastFrameTime.current = timestamp
    const dtSec = prevTime > 0 ? Math.min((timestamp - prevTime) / 1000, 0.1) : 0

    const speed = isMobile ? mobileMoveSpeed.current : BASE_MOVE_SPEED
    const moveAmount = speed * PIXELS_PER_SECOND_PER_SPEED * dtSec

    let dx = 0
    let dy = 0

    if (isMobile) {
      const stick = mobileThumbstickRef.current
      const deadzone = 0.35
      const ax = Math.abs(stick.dx)
      const ay = Math.abs(stick.dy)
      const isHorizontal = ax > deadzone && ay <= deadzone
      const isVertical = ay > deadzone && ax <= deadzone
      const isDiagonal = ax > deadzone && ay > deadzone

      if (isHorizontal) {
        dx = stick.dx > 0 ? moveAmount : -moveAmount
        setDirection(stick.dx > 0 ? "right" : "left")
      } else if (isVertical) {
        dy = stick.dy > 0 ? moveAmount : -moveAmount
        setDirection(stick.dy > 0 ? "down" : "up")
      } else if (isDiagonal) {
        mobileZigzagPhaseRef.current = 1 - mobileZigzagPhaseRef.current
        if (mobileZigzagPhaseRef.current === 0) {
          dx = stick.dx > 0 ? moveAmount : -moveAmount
          setDirection(stick.dx > 0 ? "right" : "left")
        } else {
          dy = stick.dy > 0 ? moveAmount : -moveAmount
          setDirection(stick.dy > 0 ? "down" : "up")
        }
      }
    } else {
      const keys = keysPressed.current
      if (keys.size === 0) {
        setIsWalking(false)
        walkFrameTimeRef.current = 0
        animationRef.current = requestAnimationFrame(updateMovement)
        return
      }
      if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) {
        dy = -moveAmount
        setDirection("up")
      }
      if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) {
        dy = moveAmount
        setDirection("down")
      }
      if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) {
        dx = -moveAmount
        setDirection("left")
      }
      if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) {
        dx = moveAmount
        setDirection("right")
      }
    }

    const hasInput = dx !== 0 || dy !== 0
    if (!hasInput) {
      setIsWalking(false)
      walkFrameTimeRef.current = 0
      animationRef.current = requestAnimationFrame(updateMovement)
      return
    }

    {
      setIsWalking(true)
      if (walkFrameTimeRef.current === 0) walkFrameTimeRef.current = timestamp
      if (timestamp - walkFrameTimeRef.current >= WALK_FRAME_INTERVAL_MS) {
        setWalkFrame(prev => (prev + 1) % 4)
        walkFrameTimeRef.current = timestamp
      }
      setPosition(prev => {
        const newX = dx !== 0 && canMoveTo(prev.x + dx, prev.y) ? prev.x + dx : prev.x
        const newY = dy !== 0 && canMoveTo(prev.x, prev.y + dy) ? prev.y + dy : prev.y
        return { x: newX, y: newY }
      })
    }

    animationRef.current = requestAnimationFrame(updateMovement)
  }, [canMoveTo, isMobile, BASE_MOVE_SPEED])
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dialogueOpen) {
          closeDialogue()
          e.preventDefault()
        }
        return
      }
      if (e.key === "e" || e.key === "E") {
        if (dialogueOpen) {
          closeDialogue()
        } else {
          handleInteract()
        }
        e.preventDefault()
        return
      }
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
  }, [updateMovement, dialogueOpen, closeDialogue, handleInteract])

  const interiorSpawnPosition = useMemo(() => {
    const map = MAP_REGISTRY.house_interior
    return {
      x: (map.width / 2) * TILE_SIZE - SPRITE_WIDTH / 2,
      y: (map.height - 2) * TILE_SIZE + TILE_SIZE / 2 - SPRITE_HEIGHT,
    }
  }, [])

  useEffect(() => {
    if (transitionOpacity < 1) return
    const intent = transitionIntentRef.current
    if (intent === null) return
    const CHAR_HALF = 12
    const vw = viewportSize.width
    const vh = viewportSize.height

    const t = setTimeout(() => {
      if (intent === "enter_house") {
        const map = MAP_REGISTRY.house_interior
        const mapW = map.width * TILE_SIZE
        const mapH = map.height * TILE_SIZE
        const pos = interiorSpawnPosition
        const targetX =
          mapW > vw
            ? Math.max(0, Math.min(pos.x - vw / 2 + CHAR_HALF, mapW - vw))
            : (mapW - vw) / 2
        const targetY =
          mapH > vh
            ? Math.max(0, Math.min(pos.y - vh / 2 + CHAR_HALF, mapH - vh))
            : (mapH - vh) / 2
        setCurrentMapId("house_interior")
        setCurrentHouseSection(pendingHouseSectionRef.current)
        setPosition(interiorSpawnPosition)
        setDirection("up")
        setCameraPos({ x: targetX, y: targetY })
        setTransitionOpacity(0)
        transitionIntentRef.current = null
      } else {
        const map = MAP_REGISTRY.overworld
        const mapW = map.width * TILE_SIZE
        const mapH = map.height * TILE_SIZE
        const pos = exitPosition
        const targetX =
          mapW > vw
            ? Math.max(0, Math.min(pos.x - vw / 2 + CHAR_HALF, mapW - vw))
            : (mapW - vw) / 2
        const targetY =
          mapH > vh
            ? Math.max(0, Math.min(pos.y - vh / 2 + CHAR_HALF, mapH - vh))
            : (mapH - vh) / 2
        setCurrentMapId("overworld")
        setCurrentHouseSection(null)
        setPosition(exitPosition)
        setCameraPos({ x: targetX, y: targetY })
        setTransitionOpacity(0)
        transitionIntentRef.current = null
        lastDoorTileRef.current = null
      }
    }, TRANSITION_DURATION_MS)
    return () => clearTimeout(t)
  }, [transitionOpacity, exitPosition, interiorSpawnPosition, viewportSize.width, viewportSize.height])

  useEffect(() => {
    if (currentMapId !== "overworld" || transitionOpacity > 0) return
    const { width, height } = currentMapData
    const left = position.x + HITBOX_OFFSET_X
    const top = position.y + HITBOX_OFFSET_Y
    const centerX = left + HITBOX_WIDTH / 2
    const bottom = top + HITBOX_HEIGHT
    const tileX = Math.floor(centerX / TILE_SIZE)
    const tileY = Math.floor(bottom / TILE_SIZE)
    if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) {
      lastDoorTileRef.current = null
      return
    }
    const trigger = getTransitionTriggerAt(tileX, tileY)
    // Only trigger house entry when moving up into the door (approaching from the south)
    if (trigger != null && trigger.targetMap === "house_interior" && direction === "up") {
      const prev = lastDoorTileRef.current
      if (prev === null || prev.tileX !== tileX || prev.tileY !== tileY) {
        lastDoorTileRef.current = { tileX, tileY }
        pendingHouseSectionRef.current = trigger.section ?? "about"
        setExitPosition({
          x: tileX * TILE_SIZE + TILE_SIZE / 2 - SPRITE_WIDTH / 2,
          y: (tileY + 1) * TILE_SIZE - HITBOX_OFFSET_Y,
        })
        transitionIntentRef.current = "enter_house"
        setTransitionOpacity(1)
      }
    } else {
      lastDoorTileRef.current = null
    }
  }, [currentMapId, position, direction, transitionOpacity, currentMapData.width, currentMapData.height, getTransitionTriggerAt])

  useEffect(() => {
    if (currentMapId !== "house_interior" || transitionOpacity > 0) return
    const { width, height } = currentMapData
    const left = position.x + HITBOX_OFFSET_X
    const top = position.y + HITBOX_OFFSET_Y
    const centerX = left + HITBOX_WIDTH / 2
    const bottom = top + HITBOX_HEIGHT
    const tileX = Math.floor(centerX / TILE_SIZE)
    const tileY = Math.floor(bottom / TILE_SIZE)
    if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) {
      wasOnInteriorExitRef.current = false
      return
    }
    const trigger = getTransitionTriggerAt(tileX, tileY)
    if (trigger != null && trigger.targetMap === "overworld") {
      if (!wasOnInteriorExitRef.current) {
        wasOnInteriorExitRef.current = true
        transitionIntentRef.current = "exit_house"
        setTransitionOpacity(1)
      }
    } else {
      wasOnInteriorExitRef.current = false
    }
  }, [currentMapId, position, transitionOpacity, currentMapData.width, currentMapData.height, getTransitionTriggerAt])

  // Forest end: auto-show "It's a long road ahead." when player moves to the top (road end)
  const FOREST_END_TRIGGER = { x: 14, y: 0, w: 4, h: 2 }
  useEffect(() => {
    if (currentMapId !== "overworld" || transitionOpacity > 0) return
    const left = position.x + HITBOX_OFFSET_X
    const top = position.y + HITBOX_OFFSET_Y
    const centerX = left + HITBOX_WIDTH / 2
    const bottom = top + HITBOX_HEIGHT
    const tileX = Math.floor(centerX / TILE_SIZE)
    const tileY = Math.floor(bottom / TILE_SIZE)
    const inForestEnd =
      tileY >= FOREST_END_TRIGGER.y &&
      tileY < FOREST_END_TRIGGER.y + FOREST_END_TRIGGER.h &&
      tileX >= FOREST_END_TRIGGER.x &&
      tileX < FOREST_END_TRIGGER.x + FOREST_END_TRIGGER.w
    if (inForestEnd) {
      if (!forestEndModalShownRef.current && dialogueState === null) {
        forestEndModalShownRef.current = true
        setDialogueState({ lines: ["It's a long road ahead."], index: 0 })
      }
    } else {
      forestEndModalShownRef.current = false
    }
  }, [currentMapId, position, transitionOpacity, dialogueState])

  // Handle viewport resize
  useEffect(() => {
    const updateViewport = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    }
    updateViewport()
    window.addEventListener("resize", updateViewport)
    return () => window.removeEventListener("resize", updateViewport)
  }, [])
  
  // Smooth camera following with lerp (large maps: follow player; small maps: center map in viewport)
  useEffect(() => {
    const CHARACTER_WIDTH = 24
    const CHARACTER_HEIGHT = 24
    const mapW = currentMapData.width * TILE_SIZE
    const mapH = currentMapData.height * TILE_SIZE
    const vw = viewportSize.width
    const vh = viewportSize.height

    const targetX =
      mapW > vw
        ? Math.max(0, Math.min(position.x - vw / 2 + CHARACTER_WIDTH / 2, mapW - vw))
        : (mapW - vw) / 2
    const targetY =
      mapH > vh
        ? Math.max(0, Math.min(position.y - vh / 2 + CHARACTER_HEIGHT / 2, mapH - vh))
        : (mapH - vh) / 2

    const lerpCamera = () => {
      setCameraPos(prev => {
        const newX = prev.x + (targetX - prev.x) * CAMERA_SMOOTHNESS
        const newY = prev.y + (targetY - prev.y) * CAMERA_SMOOTHNESS
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
  }, [position, viewportSize, currentMapData.width, currentMapData.height])

  // Area name: show when first entering an area, fade out after 3s
  const currentAreaName = useMemo(() => {
    if (currentMapId === "house_interior" && currentHouseSection != null) {
      return SECTION_LABELS[currentHouseSection]
    }
    if (currentMapId === "overworld") {
      if (position.y < 2 * TILE_SIZE) return "Forest End"
      if (position.y < 10 * TILE_SIZE) return "Forest Road"
      if (position.y < 11 * TILE_SIZE) return "Bridge"
      return "Village"
    }
    return currentMapData.label ?? ""
  }, [currentMapId, currentHouseSection, position.y, currentMapData.label])

  useEffect(() => {
    if (!currentAreaName) return
    if (currentAreaName === lastAreaRef.current) return
    lastAreaRef.current = currentAreaName
    setAreaLabelText(currentAreaName)
    setAreaLabelOpacity(1)
    const t = setTimeout(() => setAreaLabelOpacity(0), 3000)
    return () => clearTimeout(t)
  }, [currentAreaName])
  
  // Check if player is in tall grass and trigger rustling animation (overworld only)
  useEffect(() => {
    if (currentMapId !== "overworld") return
    const playerTileX = Math.floor((position.x + 12) / TILE_SIZE)
    const playerTileY = Math.floor((position.y + 24) / TILE_SIZE)

    const tilesToCheck = [
      { x: playerTileX, y: playerTileY },
      { x: playerTileX - 1, y: playerTileY },
      { x: playerTileX + 1, y: playerTileY },
    ]
    
    const { width: mapW, height: mapH, tiles: mapTiles } = currentMapData
    tilesToCheck.forEach(({ x, y }) => {
      if (x >= 0 && x < mapW && y >= 0 && y < mapH) {
        if (mapTiles[y][x] === TILE.TALL_GRASS) {
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
  }, [position, currentMapId, currentMapData.width, currentMapData.height, currentMapData.tiles])

  const mapWidthPx = currentMapData.width * TILE_SIZE
  const mapHeightPx = currentMapData.height * TILE_SIZE

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: currentMapId === "overworld" ? "#5AAF3A" : "#8B7355" }}>
      {/* World container that moves with camera */}
      <div
        className="absolute"
        style={{
          width: mapWidthPx,
          height: mapHeightPx,
          transform: `translate(${-cameraPos.x}px, ${-cameraPos.y}px)`,
          imageRendering: "pixelated",
        }}
      >
        {/* Render tiles: overworld or interior */}
        {currentMapId === "overworld" &&
          (currentMapData.tiles as TileType[][]).map((row, y) =>
            row.map((tile, x) => (
              <Tile
                key={`ow-${x}-${y}`}
                type={tile}
                x={x}
                y={y}
                isRustling={rustlingTiles.has(`${x}-${y}`)}
                isNight={false}
                overworldTiles={currentMapData.tiles as number[][]}
              />
            ))
          )}
        {currentMapId === "house_interior" &&
          currentMapData.tiles.map((row, y) =>
            row.map((tile, x) => (
              <InteriorTile key={`in-${x}-${y}`} type={tile as InteriorTileType} x={x} y={y} />
            ))
          )}
        {currentMapData.npcs.map((npc) => (
          <div
            key={npc.id}
            className="absolute"
            style={{
              left: npc.x * TILE_SIZE + TILE_SIZE / 2 - SPRITE_WIDTH / 2,
              top: npc.y * TILE_SIZE + TILE_SIZE - SPRITE_HEIGHT,
              zIndex: npc.y * TILE_SIZE + 40,
            }}
          >
            <NpcSprite spriteType={npc.spriteType} />
          </div>
        ))}
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

        {/* Interaction hint (facing an interactable, no dialogue open) */}
        {isInteractableInFront && !dialogueOpen && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: position.x + SPRITE_WIDTH / 2 - 28,
              top: position.y - 22,
              width: 56,
              zIndex: Math.floor(position.y + 50),
              backgroundColor: "rgba(0, 0, 0, 0.85)",
              color: "#FFE066",
              border: "2px solid #FFE066",
              borderRadius: 2,
              fontFamily: "monospace",
              fontSize: 10,
              textAlign: "center",
              padding: "4px 6px",
              imageRendering: "pixelated",
            }}
          >
            {isMobile ? "Tap ○" : "Press E"}
          </div>
        )}
      </div>
      
      {/* UI Overlay */}
      {currentMapId === "house_interior" && currentHouseSection != null && (
        <div className="absolute top-4 left-4 z-[1000]">
          <div
            className="px-3 py-2 text-xs font-mono rounded"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              color: "rgba(255, 255, 255, 0.8)",
              border: "1px solid rgba(255, 224, 102, 0.4)",
            }}
          >
            Content: {SECTION_LABELS[currentHouseSection]} (placeholder)
          </div>
        </div>
      )}
      {/* Area name: shown when first entering an area, fades out after 3s */}
      {areaLabelText && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] transition-opacity duration-500"
          style={{
            opacity: areaLabelOpacity,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            color: "#FFE066",
            border: "3px solid #FFE066",
            borderRadius: 2,
            padding: "8px 16px",
            fontFamily: "monospace",
            fontSize: 14,
            imageRendering: "pixelated",
          }}
        >
          {areaLabelText.toUpperCase()}
        </div>
      )}
      
      {/* Mobile direction controller (virtual thumbstick) */}
      {viewportSize.width < 768 && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]"
          style={{ touchAction: "none" }}
        >
          <div
            className="relative w-28 h-28 rounded-full"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.55)",
              border: "2px solid rgba(255, 255, 255, 0.45)",
              boxShadow: "0 10px 20px rgba(0,0,0,0.25)",
              imageRendering: "pixelated",
            }}
            onPointerDown={(e) => {
              const el = e.currentTarget
              el.setPointerCapture(e.pointerId)

              const rect = el.getBoundingClientRect()
              const centerX = rect.left + rect.width / 2
              const centerY = rect.top + rect.height / 2

              const updateFromPointer = (clientX: number, clientY: number) => {
                const dx = clientX - centerX
                const dy = clientY - centerY
                const maxRadius = rect.width * 0.35
                const dist = Math.hypot(dx, dy)
                const clamped = dist === 0 ? { x: 0, y: 0 } : {
                  x: (dx / dist) * Math.min(dist, maxRadius),
                  y: (dy / dist) * Math.min(dist, maxRadius),
                }

                // Move knob
                const knob = el.querySelector<HTMLDivElement>("[data-knob]")
                if (knob) {
                  knob.style.transform = `translate(${clamped.x}px, ${clamped.y}px)`
                }

                // Cardinal-only: store normalized direction for movement (no diagonal; zigzag applied in updateMovement)
                const deadZone = maxRadius * 0.25
                const push = Math.min(1, dist / maxRadius)
                mobileMoveSpeed.current = BASE_MOVE_SPEED + push * (MAX_MOBILE_MOVE_SPEED - BASE_MOVE_SPEED)
                if (dist > deadZone) {
                  const nx = dx / dist
                  const ny = dy / dist
                  mobileThumbstickRef.current = { dx: nx, dy: ny }
                } else {
                  mobileThumbstickRef.current = { dx: 0, dy: 0 }
                }
              }

              updateFromPointer(e.clientX, e.clientY)

              const handleMove = (ev: PointerEvent) => updateFromPointer(ev.clientX, ev.clientY)
              const handleUp = () => {
                // Reset knob and clear thumbstick intent
                const knob = el.querySelector<HTMLDivElement>("[data-knob]")
                if (knob) knob.style.transform = "translate(0px, 0px)"

                mobileMoveSpeed.current = BASE_MOVE_SPEED
                mobileThumbstickRef.current = { dx: 0, dy: 0 }

                window.removeEventListener("pointermove", handleMove)
                window.removeEventListener("pointerup", handleUp)
                window.removeEventListener("pointercancel", handleUp)
              }

              window.addEventListener("pointermove", handleMove)
              window.addEventListener("pointerup", handleUp, { once: true })
              window.addEventListener("pointercancel", handleUp, { once: true })
            }}
          >
            {/* Arrow indicators (icons only, no text) */}
            <svg
              className="absolute inset-0"
              viewBox="0 0 100 100"
              aria-hidden="true"
              style={{ opacity: 0.55 }}
            >
              <path d="M50 14 L40 26 H46 V38 H54 V26 H60 Z" fill="rgba(255,255,255,0.75)" />
              <path d="M50 86 L40 74 H46 V62 H54 V74 H60 Z" fill="rgba(255,255,255,0.75)" />
              <path d="M14 50 L26 40 V46 H38 V54 H26 V60 Z" fill="rgba(255,255,255,0.75)" />
              <path d="M86 50 L74 40 V46 H62 V54 H74 V60 Z" fill="rgba(255,255,255,0.75)" />
            </svg>

            {/* Thumb knob */}
            <div
              data-knob
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                border: "2px solid rgba(255, 255, 255, 0.55)",
                boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.25)",
                transition: "transform 60ms linear",
                willChange: "transform",
              }}
            />
          </div>
        </div>
      )}

      {/* Mobile interaction button (same as E key: interact or close dialogue) */}
      {viewportSize.width < 768 && (
        <button
          type="button"
          onClick={onInteractAction}
          className="absolute bottom-6 right-6 z-[1000] flex items-center justify-center rounded-full w-14 h-14 flex-shrink-0"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            border: "2px solid rgba(255, 255, 255, 0.45)",
            boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
          }}
          aria-label={dialogueOpen ? "Close dialogue" : "Interact"}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="10" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" />
          </svg>
        </button>
      )}
      
      {/* Map transition overlay (fade out / fade in) */}
      <div
        className="absolute inset-0 pointer-events-none z-[1500] transition-opacity duration-300"
        style={{
          backgroundColor: "#000",
          opacity: transitionOpacity,
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

      {/* Dialogue modal */}
      {dialogueOpen && currentDialogueLine != null && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
          onClick={advanceDialogue}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              closeDialogue()
            }
            if (e.key === "e" || e.key === "E") {
              e.preventDefault()
              advanceDialogue()
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Dialogue"
        >
          <div
            className="relative max-w-md rounded-lg px-6 py-5 shadow-xl"
            style={{
              backgroundColor: "rgba(30, 30, 40, 0.98)",
              border: "2px solid #555",
              color: "#eee",
            }}
            onClick={(e) => {
              e.stopPropagation()
              advanceDialogue()
            }}
          >
            <p className="text-center font-mono text-sm leading-relaxed">
              {currentDialogueLine}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                advanceDialogue()
              }}
              className="mt-4 w-full rounded py-2 font-mono text-xs"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.12)",
                color: "#FFE066",
                border: "1px solid #888",
              }}
            >
              {dialogueState != null && dialogueState.index + 1 < dialogueState.lines.length
                ? "Next (E)"
                : "Close (E / Esc)"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NpcSprite({ spriteType }: { spriteType?: string }) {
  // Reuse PixelCharacter for now; spriteType reserved for future visual variants
  return <PixelCharacter direction="down" isWalking={false} walkFrame={0} />
}

function Tile({ type, x, y, isRustling, isNight, overworldTiles }: { type: TileType; x: number; y: number; isRustling?: boolean; isNight?: boolean; overworldTiles?: number[][] }) {
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
      return <HouseTile style={style} x={x} y={y} color="#C75B39" roofColor="#8B4513" isNight={isNight} mapTiles={overworldTiles} />
    case TILE.HOUSE_2:
      return <HouseTile style={style} x={x} y={y} color="#4A7C99" roofColor="#2D5A7B" isNight={isNight} mapTiles={overworldTiles} />
    case TILE.HOUSE_3:
      return <HouseTile style={style} x={x} y={y} color="#7B9E6B" roofColor="#4A6B3A" isNight={isNight} mapTiles={overworldTiles} />
    case TILE.FENCE:
      return <FenceTile style={style} />
    case TILE.SIGN:
      return <SignTile style={style} />
    case TILE.WELL:
      return <WellTile style={style} />
    case TILE.HOUSE_DOOR: {
      // If this door tile is in the bottom row of a 2x2 house, the house is already drawn from the top-left
      // with the door at center-bottom — don't draw a second door here (would misalign).
      const map = overworldTiles ?? []
      const isBody = (t: number) => t === TILE.HOUSE_1 || t === TILE.HOUSE_2 || t === TILE.HOUSE_3
      const topL = map[y - 1]?.[x]
      const topR = map[y - 1]?.[x + 1]
      const botR = map[y]?.[x + 1]
      const topL2 = map[y - 1]?.[x - 1]
      const botL = map[y]?.[x - 1]
      const isBottomRowOfHouse =
        (isBody(topL) && isBody(topR) && isBody(botR)) ||
        (isBody(topL2) && isBody(topL) && isBody(botL))
      if (isBottomRowOfHouse) return <GrassTile style={style} variant={(x + y) % 3} />
      return <HouseDoorTile style={style} />
    }
    case TILE.TALL_GRASS:
      return <TallGrassTile style={style} isRustling={isRustling} />
    case TILE.CAMPFIRE:
      return <CampfireTile style={style} isNight={isNight} />
    default:
      return <GrassTile style={style} variant={0} />
  }
}

function InteriorTile({ type, x, y }: { type: InteriorTileType; x: number; y: number }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: x * TILE_SIZE,
    top: y * TILE_SIZE,
    width: TILE_SIZE,
    height: TILE_SIZE,
    imageRendering: "pixelated",
  }
  switch (type) {
    case INTERIOR.FLOOR:
      return (
        <div style={{ ...style, backgroundColor: "#A0826D" }}>
          <div className="absolute" style={{ width: 8, height: 6, backgroundColor: "#8B7355", left: 6, top: 8, borderRadius: 1 }} />
          <div className="absolute" style={{ width: 10, height: 8, backgroundColor: "#8B7355", left: 28, top: 32, borderRadius: 1 }} />
        </div>
      )
    case INTERIOR.WALL:
      return (
        <div style={{ ...style, backgroundColor: "#6B5B4F", border: "2px solid #5A4A3E" }}>
          <div className="absolute" style={{ width: 4, height: 4, backgroundColor: "#5A4A3E", left: 8, top: 12, borderRadius: 1 }} />
          <div className="absolute" style={{ width: 4, height: 4, backgroundColor: "#5A4A3E", left: 36, top: 28, borderRadius: 1 }} />
        </div>
      )
    case INTERIOR.DOOR_EXIT:
      return (
        <div style={{ ...style, backgroundColor: "#6B5B4F" }}>
          <div style={{ position: "absolute", left: 12, top: 4, width: 24, height: 40, backgroundColor: "#2D2D2D", border: "2px solid #1a1a1a", borderRadius: 2 }} />
        </div>
      )
    case INTERIOR.FURNITURE:
      return (
        <div style={{ ...style, backgroundColor: "#A0826D" }}>
          <div style={{ position: "absolute", left: 8, top: 20, width: 32, height: 20, backgroundColor: "#654321", border: "2px solid #4A3728", borderRadius: 2 }} />
        </div>
      )
    default:
      return <div style={{ ...style, backgroundColor: "#A0826D" }} />
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

function HouseTile({ style, x, y, color, roofColor, isNight, mapTiles }: { style: React.CSSProperties; x: number; y: number; color: string; roofColor: string; isNight?: boolean; mapTiles?: number[][] }) {
  const map = mapTiles ?? []
  const isTopLeft = map[y]?.[x + 1] === map[y]?.[x] && map[y + 1]?.[x] === map[y]?.[x]
  const isTopRight = map[y]?.[x - 1] === map[y]?.[x] && map[y + 1]?.[x] === map[y]?.[x]
  const isBottomLeft = map[y]?.[x + 1] === map[y]?.[x] && map[y - 1]?.[x] === map[y]?.[x]
  const isBottomRight = map[y]?.[x - 1] === map[y]?.[x] && map[y - 1]?.[x] === map[y]?.[x]
  
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

function HouseDoorTile({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ ...style, backgroundColor: "#5AAF3A", zIndex: 90 }}>
      <div
        style={{
          position: "absolute",
          left: 8,
          top: 12,
          width: 32,
          height: 36,
          backgroundColor: "#2D2D2D",
          border: "2px solid #1a1a1a",
          borderRadius: 2,
        }}
      />
    </div>
  )
}

function CampfireTile({ style, isNight }: { style: React.CSSProperties; isNight?: boolean }) {
  return (
    <div style={{ ...style, backgroundColor: "#5AAF3A", overflow: "visible", zIndex: 150 }}>
      {/* Ambient glow halo at night */}
      {isNight && (
        <div
          className="absolute"
          style={{
            width: 120,
            height: 120,
            left: -36,
            top: -44,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,220,140,0.35) 0%, rgba(255,140,40,0.22) 35%, rgba(255,90,0,0.10) 55%, transparent 75%)",
            filter: "blur(2px)",
            opacity: 1,
            pointerEvents: "none",
          }}
        />
      )}

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
      
      {/* Logs (more detailed) */}
      <div className="absolute" style={{
        width: 26,
        height: 7,
        backgroundColor: "#654321",
        left: 11,
        top: 31,
        borderRadius: 3,
        transform: "rotate(-18deg)",
        border: "1px solid #3A2A1F"
      }}>
        {/* wood rings */}
        <div className="absolute" style={{ width: 4, height: 4, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.35)", left: 2, top: 1, opacity: 0.6 }} />
        <div className="absolute" style={{ width: 3, height: 3, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.28)", left: 6, top: 2, opacity: 0.5 }} />
      </div>
      <div className="absolute" style={{
        width: 26,
        height: 7,
        backgroundColor: "#5C3A1D",
        left: 11,
        top: 27,
        borderRadius: 3,
        transform: "rotate(18deg)",
        border: "1px solid #3A2A1F"
      }}>
        <div className="absolute" style={{ width: 4, height: 4, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.35)", right: 2, top: 1, opacity: 0.6 }} />
        <div className="absolute" style={{ width: 3, height: 3, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.28)", right: 7, top: 2, opacity: 0.5 }} />
      </div>

      {/* Small embers */}
      <div className="absolute" style={{ width: 3, height: 3, left: 21, top: 28, borderRadius: "50%", backgroundColor: "#FFB703", boxShadow: "0 0 6px rgba(255, 160, 60, 0.6)" }} />
      <div className="absolute" style={{ width: 2, height: 2, left: 28, top: 30, borderRadius: "50%", backgroundColor: "#FF6B00", boxShadow: "0 0 5px rgba(255, 120, 40, 0.5)" }} />
      
      {/* Fire glow (larger at night) */}
      <div 
        className="absolute"
        style={{
          width: isNight ? 56 : 40,
          height: isNight ? 56 : 40,
          background: isNight
            ? "radial-gradient(circle, rgba(255,210,120,0.65) 0%, rgba(255,120,20,0.35) 35%, rgba(255,80,0,0.18) 55%, transparent 75%)"
            : "radial-gradient(circle, rgba(255,150,50,0.4) 0%, rgba(255,100,0,0.2) 40%, transparent 70%)",
          left: 4,
          top: 4,
          borderRadius: "50%",
          transform: isNight ? "translate(-8px, -8px)" : "none",
          opacity: isNight ? 1 : 0.5,
          transition: "opacity 1s, transform 1s"
        }}
      />
      
      {/* Smoke (animated) */}
      <div className="absolute pointer-events-none" style={{ left: 10, top: -8, width: 28, height: 34, opacity: 0.9 }}>
        <div className="absolute smoke-puff" style={{ left: 10, top: 18, width: 10, height: 10, borderRadius: "50%", backgroundColor: "rgba(220,220,220,0.22)", filter: "blur(0.4px)" }} />
        <div className="absolute smoke-puff smoke-delay" style={{ left: 4, top: 22, width: 12, height: 12, borderRadius: "50%", backgroundColor: "rgba(210,210,210,0.18)", filter: "blur(0.5px)" }} />
        <div className="absolute smoke-puff smoke-delay2" style={{ left: 14, top: 24, width: 8, height: 8, borderRadius: "50%", backgroundColor: "rgba(235,235,235,0.16)", filter: "blur(0.6px)" }} />
      </div>

      {/* Flames - animated */}
      <div className="absolute" style={{ left: 14, top: 8, width: 20, height: 24 }}>
        {/* Main flame */}
        <div 
          className="absolute"
          style={{
            width: 12,
            height: 20,
            background: isNight
              ? "linear-gradient(to top, #FF2D00 0%, #FF7A00 35%, #FFE066 70%, #FFFFFF 100%)"
              : "linear-gradient(to top, #FF4500 0%, #FF6B00 40%, #FFD700 80%, #FFFF00 100%)",
            left: 4,
            bottom: 0,
            borderRadius: "50% 50% 20% 20%",
            animation: "flicker 0.5s ease-in-out infinite alternate",
            boxShadow: isNight ? "0 0 24px 10px rgba(255,140,40,0.85)" : "0 0 8px 2px rgba(255,100,0,0.3)"
          }}
        />
        {/* Left flame */}
        <div 
          className="absolute"
          style={{
            width: 8,
            height: 14,
            background: isNight
              ? "linear-gradient(to top, #FF7A00 0%, #FFE066 55%, #FFFFFF 100%)"
              : "linear-gradient(to top, #FF6B00 0%, #FFD700 60%, #FFFF00 100%)",
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
            background: isNight
              ? "linear-gradient(to top, #FF7A00 0%, #FFE066 55%, #FFFFFF 100%)"
              : "linear-gradient(to top, #FF6B00 0%, #FFD700 60%, #FFFF00 100%)",
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
        @keyframes smokeRise {
          0% { transform: translateY(0px) translateX(0px) scale(0.9); opacity: 0; }
          15% { opacity: 0.35; }
          60% { opacity: 0.22; }
          100% { transform: translateY(-18px) translateX(-4px) scale(1.25); opacity: 0; }
        }
        .smoke-puff {
          animation: smokeRise 1.6s ease-out infinite;
        }
        .smoke-delay {
          animation-delay: 0.45s;
        }
        .smoke-delay2 {
          animation-delay: 0.9s;
        }
        @keyframes sparkle {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-15px) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
