export type SlotModelFeatures = {
    votesShare: number;
    teacherAvailable: number;
    groupAvailable: number;
    convenience: number;
    normalizedDayOfWeek: number;
    normalizedStartHour: number;
};

export const slotModelFeatureNames: Array<keyof SlotModelFeatures> = [
    "votesShare",
    "teacherAvailable",
    "groupAvailable",
    "convenience",
    "normalizedDayOfWeek",
    "normalizedStartHour",
];

export function roundScore(value: number) {
    return Math.round(value * 1000) / 1000;
}

export function getIsoDay(date: Date) {
    const day = date.getDay();
    return day === 0 ? 7 : day;
}

export function getNormalizedDayOfWeek(date: Date) {
    return roundScore((7 - getIsoDay(date)) / 6);
}

export function getNormalizedStartHour(date: Date) {
    return roundScore((date.getHours() * 60 + date.getMinutes()) / (24 * 60));
}

export function calculateSlotConvenience(startAt: Date) {
    const isoDay = getIsoDay(startAt);
    const hour = startAt.getHours() + startAt.getMinutes() / 60;
    const dayScore = isoDay <= 5 ? 1 : isoDay === 6 ? 0.65 : 0.35;
    let timeScore = 0.2;

    if (hour >= 10 && hour < 16) {
        timeScore = 1;
    } else if (hour >= 8 && hour < 18) {
        timeScore = 0.78;
    } else if (hour >= 18 && hour < 20) {
        timeScore = 0.45;
    }

    return roundScore(0.4 * dayScore + 0.6 * timeScore);
}

export function buildSlotModelFeatures(
    startAt: Date,
    votesShare: number,
    teacherAvailable: number,
    groupAvailable: number,
    convenience: number
): SlotModelFeatures {
    return {
        votesShare: roundScore(votesShare),
        teacherAvailable,
        groupAvailable,
        convenience,
        normalizedDayOfWeek: getNormalizedDayOfWeek(startAt),
        normalizedStartHour: getNormalizedStartHour(startAt),
    };
}

export function intervalsIntersect(startAt: Date, endAt: Date, otherStartAt: Date, otherEndAt: Date) {
    return startAt < otherEndAt && endAt > otherStartAt;
}
