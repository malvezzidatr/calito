export const UserPendingState = {
  WaitingDeleteConfirm: 'waiting_delete_confirm',
} as const;

export type UserPendingState = typeof UserPendingState[keyof typeof UserPendingState];
