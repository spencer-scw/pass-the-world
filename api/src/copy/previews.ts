// Text for link previews (Open Graph tags) that Discord and other apps show when a link is pasted.

export const previews = {
  siteName: 'Pass the World',
  tagline: 'Take turns playing one shared Terraria world.',

  invite: (p: { gameName: string; players: number; turnMinutes: number; orderMode: 'strict' | 'open' }) => ({
    title: `Join ${p.gameName} on Pass the World`,
    description:
      `${p.players} ${p.players === 1 ? 'player' : 'players'} · ${p.turnMinutes}-minute turns · ` +
      `${p.orderMode === 'strict' ? 'fixed rotation' : 'any order'}. Take turns playing one shared Terraria world.`,
  }),

  /** Shown for an unknown or reset invite code; the app then explains the problem. */
  inviteInvalid: { title: 'Pass the World invite', description: 'Take turns playing one shared Terraria world.' },

  redirecting: 'Opening Pass the World…',
};
