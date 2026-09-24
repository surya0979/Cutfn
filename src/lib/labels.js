/** "Today" / "Yesterday" read naturally in lowercase or possessive; dates don't. */
const RELATIVE = new Set(['Today', 'Yesterday'])

export const dayPossessive = (label, noun) => (RELATIVE.has(label) ? `${label}'s ${noun}` : `${noun[0].toUpperCase()}${noun.slice(1)} · ${label}`)
export const dayInline = (label) => (RELATIVE.has(label) ? label.toLowerCase() : label)
