export const UserPendingState = {
  WaitingDeleteConfirm: 'waiting_delete_confirm',
  WaitingGoalChoice: 'waiting_goal_choice',
  WaitingWeightUpdate: 'waiting_weight_update',
} as const;

export type UserPendingState = typeof UserPendingState[keyof typeof UserPendingState];
