export const UserPendingState = {
  WaitingDeleteConfirm: 'waiting_delete_confirm',
  WaitingGoalChoice: 'waiting_goal_choice',
  WaitingWeightUpdate: 'waiting_weight_update',
  WaitingHeightUpdate: 'waiting_height_update',
  WaitingAgeUpdate: 'waiting_age_update',
  WaitingGenderUpdate: 'waiting_gender_update',
  WaitingActivityUpdate: 'waiting_activity_update',
} as const;

export type UserPendingState = typeof UserPendingState[keyof typeof UserPendingState];
