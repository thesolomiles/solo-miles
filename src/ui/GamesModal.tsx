import { useState } from 'react'
import { useGame } from '../state/store'
import { ARCADE_GAMES, type ArcadeGame } from '../config/arcade'

function Badge({ game }: { game: ArcadeGame }) {
  if (game.badge === 'unlocked') return <span className="gselect__badge gselect__badge--on">Unlocked</span>
  return <span className="gselect__badge gselect__badge--lock">Locked</span>
}

function Card({
  game,
  selected,
  onPick,
}: {
  game: ArcadeGame
  selected: boolean
  onPick: () => void
}) {
  const play = () => {
    if (game.locked) return
    useGame.getState().requestMinigame('pacman')
  }
  return (
    <div
      className={'gselect__card' + (selected ? ' is-selected' : '') + (game.locked ? ' is-locked' : '')}
      onMouseEnter={onPick}
      onFocus={onPick}
      onClick={() => {
        onPick()
        if (!game.locked) play()
      }}
      role="button"
      tabIndex={game.locked ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !game.locked) {
          e.preventDefault()
          play()
        }
      }}
    >
      <div
        className="gselect__thumb"
        style={
          game.thumb
            ? { backgroundImage: `url(${game.thumb})` }
            : { background: `linear-gradient(150deg, ${game.thumbFrom}, ${game.thumbTo})` }
        }
      >
        <Badge game={game} />
        {game.locked && <span className="gselect__lock" aria-hidden />}
        {selected && !game.locked && (
          <button
            className="gselect__select"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              play()
            }}
          >
            SELECT
          </button>
        )}
      </div>
      <h3 className="gselect__name">{game.title}</h3>
    </div>
  )
}

/** Wood-framed arcade picker — E on the café machines. Pac-Man is the only live game. */
export function GamesModal() {
  const close = useGame((s) => s.closeGames)
  const [sel, setSel] = useState(ARCADE_GAMES[0].id)
  return (
    <div className="gselect">
      <div className="gselect__frame">
        <span className="gselect__stud gselect__stud--tl" />
        <span className="gselect__stud gselect__stud--tr" />
        <span className="gselect__stud gselect__stud--bl" />
        <span className="gselect__stud gselect__stud--br" />
        <span className="gselect__stud gselect__stud--ml" />
        <span className="gselect__stud gselect__stud--mr" />
        <header className="gselect__head">
          <h2 className="gselect__title">Game Selector</h2>
        </header>
        <div className="gselect__grid">
          {ARCADE_GAMES.map((g) => (
            <Card key={g.id} game={g} selected={sel === g.id} onPick={() => setSel(g.id)} />
          ))}
        </div>
        <footer className="gselect__foot">
          <button className="gselect__exit" type="button" onClick={close}>
            Close / Back to cafe
          </button>
        </footer>
      </div>
    </div>
  )
}
