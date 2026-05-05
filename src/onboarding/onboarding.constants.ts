export const OnboardingStep = {
    WaitingConsent:  'waiting_consent',
    WaitingGoal:     'waiting_goal',
    WaitingWeight:   'waiting_weight',
    WaitingHeight:   'waiting_height',
    WaitingAge:      'waiting_age',
    WaitingGender:   'waiting_gender',
    WaitingActivity: 'waiting_activity',
} as const;

export type OnboardingStep = typeof OnboardingStep[keyof typeof OnboardingStep];