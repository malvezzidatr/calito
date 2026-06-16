export const OnboardingStep = {
    WaitingConsent:                  'waiting_consent',
    WaitingNutritionistChoice:       'waiting_nutritionist_choice',
    WaitingNutritionistGoal:         'waiting_nutritionist_goal',
    WaitingNutritionistGoals:        'waiting_nutritionist_goals',
    WaitingNutritionistGoalsConfirm: 'waiting_nutritionist_goals_confirm',
    WaitingNutritionistProfile:      'waiting_nutritionist_profile',
    WaitingNutritionistProfileConfirm: 'waiting_nutritionist_profile_confirm',
    WaitingGoal:                     'waiting_goal',
    WaitingWeight:                   'waiting_weight',
    WaitingHeight:                   'waiting_height',
    WaitingAge:                      'waiting_age',
    WaitingGender:                   'waiting_gender',
    WaitingActivity:                 'waiting_activity',
} as const;

export type OnboardingStep = typeof OnboardingStep[keyof typeof OnboardingStep];