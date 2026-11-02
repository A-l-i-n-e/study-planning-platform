import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/router/route-paths';
import { pollsApi } from '@/shared/api/polls.api';
import { mockPolls } from '@/shared/lib/mock-data';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { PollDetails, PollRecommendation } from '@/shared/types/poll';
import { Button } from '@/shared/ui/button/Button';
import { Card } from '@/shared/ui/card/Card';
import { EmptyState } from '@/shared/ui/empty-state/EmptyState';
import { SectionHeader } from '@/shared/ui/section-header/SectionHeader';
import { PageLayout } from '@/widgets/page-layout';

const pollStatusLabel: Record<'active' | 'closed' | 'draft', string> = {
    active: 'Активен',
    closed: 'Завершён',
    draft: 'Черновик',
};

const toPercent = (value: number) => Math.round(value * 100);

const recommendationStatusLabel: Record<PollRecommendation['recommendationStatus'], string> = {
    recommended: 'Рекомендован',
    acceptable: 'Допустим',
    low_support: 'Мало голосов',
    conflict: 'Конфликт',
    manual_review: 'Проверить вручную',
};

const recommendationStatusClass: Record<PollRecommendation['recommendationStatus'], string> = {
    recommended: 'status-chip--active',
    acceptable: 'status-chip--draft',
    low_support: 'status-chip--warning',
    conflict: 'status-chip--closed',
    manual_review: 'status-chip--warning',
};

const formatAvailability = (value: boolean | null) => {
    if (value === null) {
        return 'Нет данных';
    }

    return value ? 'Свободно' : 'Есть конфликт';
};

const getConflictLabel = (recommendation: PollRecommendation) => {
    const parts = [
        recommendation.conflicts.teacher ? 'преподаватель' : '',
        recommendation.conflicts.groupIds.length ? `группы: ${recommendation.conflicts.groupIds.length}` : '',
        recommendation.conflicts.studentsCount ? `студенты: ${recommendation.conflicts.studentsCount}` : '',
    ].filter(Boolean);

    return parts.join(', ');
};

export const PollDetailsPage = () => {
    const { id } = useParams();
    const currentUser = tokenStorage.getUser();
    const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin';
    const [poll, setPoll] = useState<PollDetails | undefined>(() => mockPolls.find((item) => item.id === id));
    const [recommendations, setRecommendations] = useState<PollRecommendation[]>([]);
    const canVote = currentUser?.role === 'student' && poll?.status === 'active';
    const canReadPoll =
        !poll ||
        currentUser?.role !== 'teacher' ||
        poll.isMine ||
        poll.teacher === currentUser.name;
    const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
    const [approvedOption, setApprovedOption] = useState<string | null>(null);
    const [approvingOptionId, setApprovingOptionId] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState('');

    useEffect(() => {
        let cancelled = false;

        if (!id) {
            return () => {
                cancelled = true;
            };
        }

        const loadPoll = () => {
            Promise.all([
                pollsApi.getById(id),
                isTeacher ? pollsApi.getRecommendations(id).catch(() => []) : Promise.resolve([]),
            ])
                .then(([loadedPoll, loadedRecommendations]) => {
                    if (cancelled) {
                        return;
                    }

                    setPoll(loadedPoll);
                    setRecommendations(loadedRecommendations);
                    setSelectedOptionIds(loadedPoll.selectedOptionIds ?? []);
                })
                .catch(() => {
                    if (!cancelled) {
                        setPoll(mockPolls.find((item) => item.id === id));
                        setRecommendations([]);
                        setSelectedOptionIds([]);
                    }
                });
        };

        loadPoll();
        const intervalId = window.setInterval(loadPoll, 3000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [id, isTeacher]);

    const totalVotes = useMemo(
        () => poll?.options.reduce((sum, option) => sum + option.votesCount, 0) ?? 0,
        [poll],
    );
    const percentBase = poll?.participantsCount || totalVotes;
    const rankedOptions = useMemo(
        () => (poll?.options ?? [])
            .map((option) => ({
                ...option,
                percent: percentBase ? Math.round((option.votesCount / percentBase) * 100) : 0,
            }))
            .sort((left, right) =>
                right.votesCount - left.votesCount ||
                left.date.localeCompare(right.date, 'ru') ||
                left.time.localeCompare(right.time, 'ru')
            )
            .map((option, index) => ({
                ...option,
                rank: index + 1,
            })),
        [poll, percentBase],
    );
    const recommendationRows = useMemo(
        () => recommendations.length
            ? recommendations.map((recommendation) => ({
                id: recommendation.optionId,
                rank: recommendation.rank,
                date: recommendation.date,
                time: recommendation.time,
                durationMinutes: recommendation.durationMinutes,
                votesCount: recommendation.votesCount,
                participantsCount: recommendation.participantsCount,
                percent: toPercent(recommendation.votesShare),
                dynamicPminPercent: toPercent(recommendation.dynamicPmin),
                minVotesRequired: recommendation.minVotesRequired,
                passedThreshold: recommendation.passedThreshold,
                thresholdExplanation: recommendation.thresholdExplanation,
                teacherAvailable: recommendation.teacherAvailable,
                groupAvailable: recommendation.groupAvailable,
                teacherAvailabilityPercent: toPercent(recommendation.teacherAvailabilityScore),
                groupAvailabilityPercent: toPercent(recommendation.groupAvailabilityScore),
                conveniencePercent: toPercent(recommendation.convenienceScore),
                durationScorePercent: toPercent(recommendation.durationScore),
                finalScorePercent: toPercent(recommendation.finalScore),
                hasAnyConflict: recommendation.conflicts.hasAnyConflict,
                conflictLabel: getConflictLabel(recommendation),
                recommendationStatus: recommendation.recommendationStatus,
                warnings: recommendation.warnings,
                explanation: recommendation.explanation,
            }))
            : rankedOptions.map((option) => ({
                id: option.id,
                rank: option.rank,
                date: option.date,
                time: option.time,
                durationMinutes: option.durationMinutes ?? 0,
                votesCount: option.votesCount,
                participantsCount: poll?.participantsCount ?? 0,
                percent: option.percent,
                dynamicPminPercent: 50,
                minVotesRequired: 2,
                passedThreshold: option.percent >= 50,
                thresholdExplanation: '',
                teacherAvailable: true,
                groupAvailable: true,
                teacherAvailabilityPercent: 100,
                groupAvailabilityPercent: 100,
                conveniencePercent: 0,
                durationScorePercent: 0,
                finalScorePercent: option.percent,
                hasAnyConflict: false,
                conflictLabel: '',
                recommendationStatus: 'manual_review' as const,
                warnings: [],
                explanation: 'Рекомендации доступны после расчёта сервером.',
            })),
        [poll?.participantsCount, rankedOptions, recommendations],
    );
    const hasTiedLeaders =
        recommendationRows.length > 1 && recommendationRows[0].finalScorePercent === recommendationRows[1].finalScorePercent;
    const canApproveResult = poll?.status === 'closed' && recommendationRows.length > 0;

    const updateLocalVotes = (nextOptionIds: string[]) => {
        setPoll((currentPoll) => {
            if (!currentPoll) {
                return currentPoll;
            }

            const previousIds = new Set(selectedOptionIds);
            const nextIds = new Set(nextOptionIds);

            return {
                ...currentPoll,
                options: currentPoll.options.map((option) => {
                    const wasSelected = previousIds.has(option.id);
                    const isSelected = nextIds.has(option.id);
                    const voteDelta = Number(isSelected) - Number(wasSelected);

                    return {
                        ...option,
                        votesCount: Math.max(0, option.votesCount + voteDelta),
                    };
                }),
                votesCount: Math.max(0, (currentPoll.votesCount ?? totalVotes) + nextOptionIds.length - selectedOptionIds.length),
                selectedOptionIds: nextOptionIds,
            };
        });
    };

    const syncVote = async (nextOptionIds: string[]) => {
        if (!canVote || !poll) {
            return;
        }

        if (!poll.rawId) {
            updateLocalVotes(nextOptionIds);
            setSelectedOptionIds(nextOptionIds);
            setActionMessage('Голос учтен. Результаты обновлены.');
            return;
        }

        try {
            setActionMessage('');
            if (nextOptionIds.length === 0) {
                await pollsApi.clearVote(poll.rawId);
            } else {
                const rawOptionIds = poll.options
                    .filter((option) => nextOptionIds.includes(option.id))
                    .map((option) => option.rawId ?? option.id);

                await pollsApi.vote(poll.rawId, rawOptionIds);
            }
            const updatedPoll = await pollsApi.getById(poll.rawId);
            setPoll(updatedPoll);
            setSelectedOptionIds(updatedPoll.selectedOptionIds ?? nextOptionIds);
            setActionMessage('Голос учтен. Результаты обновлены.');
        } catch {
            setActionMessage('Не удалось отправить голос. Проверьте дедлайн и доступ к опросу.');
        }
    };

    const approveResult = async () => {
        if (!poll?.rawId || !approvedOption) {
            return;
        }

        try {
            setActionMessage('');
            setApprovingOptionId(approvedOption);
            const approvedPoll = await pollsApi.approveResult(poll.rawId, approvedOption);
            setPoll(approvedPoll);
            setActionMessage('Итоговое занятие согласовано.');
        } catch {
            setActionMessage('Не удалось согласовать итог. Опрос должен быть закрыт, а занятие не должно существовать раньше.');
        } finally {
            setApprovingOptionId(null);
        }
    };

    if (!poll || !canReadPoll) {
        return (
            <PageLayout>
                <EmptyState
                    title="Опрос не найден"
                    description="Похоже, этот маршрут пока не связан с реальными данными. Вернитесь к списку и выберите другой опрос."
                    actionLabel="К опросам"
                    actionTo={ROUTES.POLLS}
                />
            </PageLayout>
        );
    }

    return (
        <PageLayout>
            <section className="page-section">
                <Link className="button button--secondary button--sm" to={ROUTES.POLLS}>
                    Назад к опросам
                </Link>

                <SectionHeader
                    eyebrow="Детали опроса"
                    title={poll.title}
                    description={`${poll.description} Преподаватель: ${poll.teacher}. Группа: ${poll.group}.`}
                />

                <div className="cards-grid cards-grid--two">
                    <Card className="detail-panel">
                        <h2 className="detail-panel__title">Информация</h2>
                        <div className="meta-grid">
                            <div className="meta-item">
                                <span className="meta-item__label">Преподаватель</span>
                                <span className="meta-item__value">{poll.teacher}</span>
                            </div>
                            <div className="meta-item">
                                <span className="meta-item__label">Группа</span>
                                <span className="meta-item__value">{poll.group}</span>
                            </div>
                            <div className="meta-item">
                                <span className="meta-item__label">Дедлайн</span>
                                <span className="meta-item__value deadline-text">{poll.deadline}</span>
                            </div>
                            <div className="meta-item">
                                <span className="meta-item__label">Статус</span>
                                <span className="meta-item__value">{pollStatusLabel[poll.status]}</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="detail-panel">
                        <h2 className="detail-panel__title">Результаты</h2>
                        <p className="subtle-text">Система считает голоса и рекомендует вариант, но итоговое решение принимает преподаватель.</p>
                        <div className="progress-list">
                            {rankedOptions.map((option) => (
                                <div className="progress-item" key={option.id}>
                                    <div className="progress-item__top">
                                        <span>
                                            #{option.rank} {option.date} · {option.time}
                                        </span>
                                        <span>{option.votesCount} голосов · {option.percent}%</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div className="progress-bar__fill" style={{ width: `${option.percent}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {isTeacher ? (
                    <Card className="stack">
                        <h2 className="detail-panel__title">Рейтинг вариантов</h2>
                        <p className="subtle-text">
                            {poll.status !== 'closed'
                                ? 'Рекомендации обновляются после каждого голоса. Подтверждение станет доступно, когда проголосуют все выбранные студенты или пройдет дедлайн.'
                                : hasTiedLeaders
                                    ? 'Несколько вариантов получили одинаковый итоговый балл. Выберите финальную дату вручную.'
                                    : 'Первым показан вариант с лучшим итоговым баллом. Итоговое решение остается за преподавателем.'}
                        </p>
                        <div className="record-list approval-list">
                            {recommendationRows.map((option) => {
                                const chipClass = recommendationStatusClass[option.recommendationStatus];

                                return (
                                    <button
                                        type="button"
                                        className={`record-item approval-option ${approvedOption === option.id ? 'approval-option--active' : ''}`}
                                        key={option.id}
                                        onClick={() => setApprovedOption(option.id)}
                                    >
                                        <span className={`status-chip ${chipClass}`}>
                                            {recommendationStatusLabel[option.recommendationStatus]} · #{option.rank}
                                        </span>
                                        <h3 className="record-item__title">{option.date}</h3>
                                        <p className="record-item__meta">
                                            {option.time} · {option.durationMinutes} мин · Итоговая оценка {option.finalScorePercent}%
                                        </p>
                                        <div className="recommendation-metrics">
                                            <span className="recommendation-metric">Голоса {option.votesCount} из {option.participantsCount}</span>
                                            <span className="recommendation-metric">Доля голосов {option.percent}%</span>
                                            <span className="recommendation-metric">Порог голосов {option.dynamicPminPercent}%</span>
                                            <span className="recommendation-metric">Минимум голосов {option.minVotesRequired}</span>
                                            <span className={`recommendation-metric ${option.teacherAvailable ? '' : 'recommendation-metric--warning'}`}>
                                                Доступность преподавателя {formatAvailability(option.teacherAvailable)}
                                            </span>
                                            <span className={`recommendation-metric ${option.groupAvailable ? '' : 'recommendation-metric--warning'}`}>
                                                Доступность группы {formatAvailability(option.groupAvailable)}
                                            </span>
                                            <span className="recommendation-metric">Удобство времени {option.conveniencePercent}%</span>
                                            <span className="recommendation-metric">Продолжительность {option.durationScorePercent}%</span>
                                            <span className={`recommendation-metric ${option.passedThreshold ? '' : 'recommendation-metric--warning'}`}>
                                                Порог {option.passedThreshold ? 'пройден' : 'не пройден'}
                                            </span>
                                        </div>
                                        {option.thresholdExplanation ? (
                                            <p className="record-item__meta">{option.thresholdExplanation}</p>
                                        ) : null}
                                        {option.hasAnyConflict ? (
                                            <p className="record-item__meta">Пересечение: {option.conflictLabel}</p>
                                        ) : null}
                                        {option.warnings.length > 0 ? (
                                            <p className="record-item__meta">{option.warnings.join(' ')}</p>
                                        ) : null}
                                        <p className="record-item__meta">{option.explanation}</p>
                                    </button>
                                );
                            })}
                        </div>
                        <Button disabled={!canApproveResult || !approvedOption || approvingOptionId !== null} onClick={approveResult}>
                            {approvingOptionId ? 'Сохраняем...' : 'Выбрать этот вариант'}
                        </Button>
                    </Card>
                ) : null}

                <Card className="stack">
                    <h2 className="detail-panel__title">Варианты времени</h2>
                    {actionMessage ? <div className="alert">{actionMessage}</div> : null}
                    <div className="cards-grid cards-grid--two">
                        {poll.options.map((option) => {
                            const isSelected = selectedOptionIds.includes(option.id);

                            return (
                                <Card
                                    className="detail-panel"
                                    hoverable
                                    key={option.id}
                                    style={{
                                        borderColor: isSelected ? 'var(--color-border-strong)' : undefined,
                                        background: isSelected ? 'var(--color-card-bg-soft)' : undefined,
                                    }}
                                >
                                    <div className="mini-stack">
                                        <span className="eyebrow">{option.label}</span>
                                        <h3 className="quick-link__title">{option.date}</h3>
                                        <p>{option.time}</p>
                                    </div>

                                    <div className="meta-grid">
                                        <div className="meta-item">
                                            <span className="meta-item__label">Голосов</span>
                                            <span className="meta-item__value">{option.votesCount}</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className={`button ${isSelected ? 'button--primary' : 'button--secondary'} button--md`}
                                        disabled={!canVote}
                                        onClick={() => {
                                            if (canVote) {
                                                const nextOptionIds = isSelected
                                                    ? selectedOptionIds.filter((selectedId) => selectedId !== option.id)
                                                    : [...selectedOptionIds, option.id];

                                                void syncVote(nextOptionIds);
                                            }
                                        }}
                                    >
                                        {canVote ? (isSelected ? 'Выбрано' : 'Выбрать вариант') : 'Просмотр'}
                                    </button>
                                </Card>
                            );
                        })}
                    </div>
                    {canVote ? (
                        <p className="subtle-text">Можно выбрать несколько подходящих вариантов. Каждый выбор сразу обновляет результаты.</p>
                    ) : null}
                </Card>
            </section>
        </PageLayout>
    );
};
