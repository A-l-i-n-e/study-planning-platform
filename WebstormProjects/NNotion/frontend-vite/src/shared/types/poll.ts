export type PollStatus = 'active' | 'closed' | 'draft';

export interface PollOption {
    id: string;
    rawId?: number;
    label: string;
    date: string;
    time: string;
    startAt?: string;
    endAt?: string;
    durationMinutes?: number;
    location: string;
    votesCount: number;
    format?: 'offline';
    link?: string | null;
}

export interface PollPreview {
    id: string;
    rawId?: number;
    title: string;
    description: string;
    teacher: string;
    teacherId?: number;
    group: string;
    deadline: string;
    status: PollStatus;
    optionsCount: number;
    isMine?: boolean;
    participantsCount?: number;
    votesCount?: number;
    selectedOptionIds?: string[];
}

export interface PollDetails extends PollPreview {
    options: PollOption[];
}

export interface PollRecommendation {
    optionId: string;
    rawOptionId: number;
    rank: number;
    date: string;
    time: string;
    startAt: string;
    endAt: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    votesCount: number;
    participantsCount: number;
    votesShare: number;
    dynamicPmin: number;
    minVotesRequired: number;
    passedThreshold: boolean;
    thresholdExplanation: string;
    teacherAvailable: boolean | null;
    groupAvailable: boolean | null;
    studentsAvailable: boolean | null;
    teacherAvailabilityScore: number;
    groupAvailabilityScore: number;
    convenienceScore: number;
    durationScore: number;
    finalScore: number;
    recommendationStatus: 'recommended' | 'acceptable' | 'low_support' | 'conflict' | 'manual_review';
    warnings: string[];
    explanation: string;
    conflicts: {
        hasAnyConflict: boolean;
        teacher: boolean;
        groupIds: number[];
        studentsCount: number;
    };
}
