// Every error message the API returns. Handlers throw `new HttpError(status, errors.x)`.

export const errors = {
  // Auth & account linking
  notSignedIn: 'Not signed in',
  sessionExpired: 'Session expired, sign in again',
  discordNotConfigured: 'Discord sign-in is not configured',
  signInFailed: 'Sign-in failed, please try again',
  discordRejectedSignIn: 'Discord rejected the sign-in',
  discordProfileUnavailable: 'Could not read your Discord profile',
  linkCodeExpired: 'Link code expired, start again',
  linkCodeAlreadyUsed: 'Link code already used',
  linkCodeInvalid: 'That code is invalid or expired',

  // Games & players
  gameNotFound: 'Game not found',
  adminOnly: 'Only game admins can do that',
  inviteInvalid: 'Invite link is invalid or was reset',
  gameFinished: 'That game has finished',
  orderMustListEveryone: 'Order must list every player exactly once',
  ownerAlwaysAdmin: 'The owner is always an admin',
  invalidStatusChange: (from: string, to: string) => `Cannot go from ${from} to ${to}`,
  saveNamesLocked: "World and character names can't change after the game starts",
  discordWebhookInvalid: 'Must be a Discord webhook URL',
  gameAlreadyStarted: 'Game already started',
  startingSaveMissing: 'Upload the starting save from the mod first',
  startingSaveLocked: 'The starting save can only be replaced before the game starts',
  noTurnInProgress: 'No turn in progress',
  turnChangedState: 'Turn changed state, refresh and try again',
  rollbackDuringActiveTurn: 'Wait for (or skip) the active turn before rolling back',

  // Turns
  turnNotFound: 'Turn not found',
  notInRotation: 'You are not in the rotation for this game',
  gameNotRunning: (status: string) => `Game is ${status}`,
  notYourTurn: 'This is not your turn',
  notYourTurnYet: 'It is not your turn yet',
  tookLastTurn: 'You took the last turn, let someone else go',
  someoneElsePlaying: 'Someone else is playing this turn',
  someoneElseClaimed: 'Someone else just claimed this turn',
  turnInStatus: (status: string) => `Turn is ${status}`,
  turnAlreadyInStatus: (status: string) => `Turn is already ${status}`,
  turnExpired: 'Turn has expired',
  turnEndedBeforeUpload: 'Turn ended before the upload finished',

  // Save uploads & downloads
  saveTooLarge: (maxMb: number) => `Save is larger than ${maxMb} MB`,
  emptyUpload: 'Empty upload',
  notASaveBundle: 'Upload is not a save bundle (zip)',
  uploadCorrupted: 'Upload was corrupted in transit (hash mismatch)',
  snapshotNotFound: 'Snapshot not found',
  saveFileMissing: 'Save file is missing from storage',

  // Generic
  notFound: 'Not found',
  internal: 'Internal error',
} as const;
