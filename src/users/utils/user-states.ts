export const UserPendingState = {
  WaitingDeleteConfirm: 'waiting_delete_confirm',
  WaitingGoalChoice: 'waiting_goal_choice',
} as const;

export type UserPendingState = typeof UserPendingState[keyof typeof UserPendingState];
