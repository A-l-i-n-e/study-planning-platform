import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi } from '@/shared/api/groups.api';
import { pollsApi, type StudyGroup } from '@/shared/api/polls.api';
import type { BackendUser } from '@/shared/api/users.api';
import { mockPolls } from '@/shared/lib/mock-data';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { PollPreview, PollStatus } from '@/shared/types/poll';
import { Button } from '@/shared/ui/button/Button';
import { Card } from '@/shared/ui/card/Card';
import { Input } from '@/shared/ui/input/Input';
import { SectionHeader } from '@/shared/ui/section-header/SectionHeader';
import { Select } from '@/shared/ui/select/Select';
import { Textarea } from '@/shared/ui/textarea/Textarea';
import { PageLayout } from '@/widgets/page-layout';

type PollFilter = 'all' | 'active' | 'closed';
type LessonType = 'лекция' | 'семинар' | 'консультация' | 'мастер-класс' | 'кружок' | 'другое';
type LessonDuration = 45 | 60 | 90 | 120;
type SuggestedSlot = {
    id: string;
    start: Date;
    end: Date;
    label: string;
};

const minPollDates = 2;
const maxPollDates = 7;
const lessonTypes: LessonType[] = ['лекция', 'семинар', 'консультация', 'мастер-класс', 'кружок', 'другое'];
const lessonDurationOptions: LessonDuration[] = [45, 60, 90, 120];

const filterLabels: Record<PollFilter, string> = {
    all: 'Все',
    active: 'Активные',
    closed: 'Завершенные',
};

const statusLabels: Record<PollStatus, string> = {
    active: 'Активен',
    closed: 'Завершен',
    draft: 'Черновик',
};

const statusClasses: Record<PollStatus, string> = {
    active: 'status-chip--active',
    closed: 'status-chip--closed',
    draft: 'status-chip--warning',
};

const toDateTimeLocalValue = (date: Date) => {
    const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;

    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const toDateInputValue = (date: Date) => toDateTimeLocalValue(date).slice(0, 10);

const toTomorrowDateInputValue = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return toDateInputValue(tomorrow);
};

const isDeadlineUrgent = (deadline: string) => {
    const parsed = new Date(deadline);

    if (Number.isNaN(parsed.getTime())) {
        return true;
    }

    return parsed.getTime() - Date.now() < 24 * 60 * 60 * 1000;
};

const slotDateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
});

const slotTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
});

const suggestedSlotStarts = [
    { hour: 9, minute: 0 },
    { hour: 10, minute: 30 },
    { hour: 12, minute: 0 },
    { hour: 13, minute: 30 },
    { hour: 15, minute: 0 },
    { hour: 16, minute: 30 },
    { hour: 18, minute: 0 },
    { hour: 19, minute: 30 },
];

const buildSuggestedSlots = (dateValue: string, durationMinutes: LessonDuration): SuggestedSlot[] => {
    const base = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(base.getTime())) {
        return [];
    }

    const now = new Date();

    return suggestedSlotStarts
        .map(({ hour, minute }) => {
            const start = new Date(base);
            start.setHours(hour, minute, 0, 0);
            const end = new Date(start);
            end.setMinutes(start.getMinutes() + durationMinutes);

            return {
                id: `${dateValue}-${hour}-${minute}-${durationMinutes}`,
                start,
                end,
                label: `${slotDateFormatter.format(start)}, ${slotTimeFormatter.format(start)} - ${slotTimeFormatter.format(end)}`,
            };
        })
        .filter((slot) => slot.start.getTime() > now.getTime());
};

export const PollsPage = () => {
    const [activeFilter, setActiveFilter] = useState<PollFilter>('all');
    const [pollsFromApi, setPollsFromApi] = useState<PollPreview[]>([]);
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [teachingDisciplines, setTeachingDisciplines] = useState<string[]>([]);
    const [groupStudents, setGroupStudents] = useState<BackendUser[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
    const [apiReady, setApiReady] = useState(false);
    const [serverMessage, setServerMessage] = useState('');
    const [pollTitle, setPollTitle] = useState('');
    const [pollDescription, setPollDescription] = useState('');
    const [pollGroup, setPollGroup] = useState('');
    const [pollDiscipline, setPollDiscipline] = useState('');
    const [lessonType, setLessonType] = useState<LessonType>('консультация');
    const [lessonDurationMinutes, setLessonDurationMinutes] = useState<LessonDuration>(90);
    const [pollDeadline, setPollDeadline] = useState('');
    const [pollDateDraft, setPollDateDraft] = useState('');
    const [pollDates, setPollDates] = useState<string[]>([]);
    const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
    const [hasManualSlotSelection, setHasManualSlotSelection] = useState(false);
    const currentUser = tokenStorage.getUser();
    const canCreatePolls = currentUser?.role === 'teacher';
    const minimumPollDate = toTomorrowDateInputValue();

    useEffect(() => {
        let cancelled = false;

        Promise.all([
            pollsApi.list(),
            currentUser?.role === 'teacher' ? groupsApi.teachingDisciplines() : Promise.resolve([]),
        ])
            .then(([polls, disciplines]) => {
                if (cancelled) {
                    return;
                }

                setPollsFromApi(polls.map((poll) => ({
                    ...poll,
                    isMine: currentUser?.role === 'teacher' && poll.teacherId === currentUser.id,
                })));
                setTeachingDisciplines(disciplines);
                setApiReady(true);
            })
            .catch(() => {
                if (!cancelled) {
                    setApiReady(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [currentUser?.id, currentUser?.role]);

    useEffect(() => {
        if (!pollDiscipline) {
            return;
        }

        let cancelled = false;

        groupsApi.byDiscipline(pollDiscipline)
            .then((loadedGroups) => {
                if (cancelled) {
                    return;
                }

                setGroups(loadedGroups);
                setPollGroup('');
                setGroupStudents([]);
                setSelectedStudentIds([]);
                setSelectedSlotIds([]);
                setIsStudentPickerOpen(false);
            })
            .catch(() => {
                if (!cancelled) {
                    setGroups([]);
                    setPollGroup('');
                    setGroupStudents([]);
                    setSelectedStudentIds([]);
                    setSelectedSlotIds([]);
                    setIsStudentPickerOpen(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [pollDiscipline]);

    useEffect(() => {
        const groupId = Number(pollGroup);

        if (!groupId) {
            return;
        }

        let cancelled = false;

        groupsApi.students(groupId)
            .then((students) => {
                if (cancelled) {
                    return;
                }

                setGroupStudents(students);
                setSelectedStudentIds(students.map((student) => student.id));
                setIsStudentPickerOpen(true);
            })
            .catch(() => {
                if (!cancelled) {
                    setGroupStudents([]);
                    setSelectedStudentIds([]);
                    setIsStudentPickerOpen(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [pollGroup]);

    const polls = useMemo(() => apiReady ? pollsFromApi : mockPolls, [apiReady, pollsFromApi]);

    const visiblePolls = useMemo(() => {
        return polls.filter((poll) => {
            if (activeFilter === 'active') {
                return poll.status === 'active';
            }

            if (activeFilter === 'closed') {
                return poll.status === 'closed';
            }

            return true;
        });
    }, [activeFilter, polls]);

    const sortedPollDates = useMemo(() => [...pollDates].sort(), [pollDates]);

    const suggestedSlots = useMemo(() => {
        const groupId = Number(pollGroup);

        if (sortedPollDates.length === 0 || !groupId) {
            return [];
        }

        return sortedPollDates.flatMap((date) => buildSuggestedSlots(date, lessonDurationMinutes));
    }, [lessonDurationMinutes, sortedPollDates, pollGroup]);

    const availableSlotIds = useMemo(() => new Set(suggestedSlots.map((slot) => slot.id)), [suggestedSlots]);
    const defaultSlotIds = useMemo(() => suggestedSlots.slice(0, 5).map((slot) => slot.id), [suggestedSlots]);
    const effectiveSelectedSlotIds = useMemo(() => {
        const keptIds = selectedSlotIds.filter((id) => availableSlotIds.has(id));

        return hasManualSlotSelection ? keptIds : defaultSlotIds;
    }, [availableSlotIds, defaultSlotIds, hasManualSlotSelection, selectedSlotIds]);
    const selectedSlots = useMemo(
        () => suggestedSlots.filter((slot) => effectiveSelectedSlotIds.includes(slot.id)),
        [effectiveSelectedSlotIds, suggestedSlots],
    );
    const selectedGroup = useMemo(
        () => groups.find((group) => String(group.id) === pollGroup),
        [groups, pollGroup],
    );

    const allStudentsSelected = groupStudents.length > 0 && selectedStudentIds.length === groupStudents.length;

    const toggleAllStudents = (checked: boolean) => {
        setSelectedStudentIds(checked ? groupStudents.map((student) => student.id) : []);
    };

    const toggleStudent = (studentId: number, checked: boolean) => {
        setSelectedStudentIds((items) =>
            checked ? [...items, studentId] : items.filter((item) => item !== studentId),
        );
    };

    const toggleSlot = (slotId: string, checked: boolean) => {
        setHasManualSlotSelection(true);
        setSelectedSlotIds((items) => {
            const baseIds = hasManualSlotSelection ? items.filter((item) => availableSlotIds.has(item)) : defaultSlotIds;

            return checked
                ? Array.from(new Set([...baseIds, slotId]))
                : baseIds.filter((item) => item !== slotId);
        });
    };

    const canAddPollDate = Boolean(pollDateDraft)
        && pollDateDraft >= minimumPollDate
        && !pollDates.includes(pollDateDraft)
        && pollDates.length < maxPollDates;

    const addPollDate = () => {
        if (!canAddPollDate) {
            return;
        }

        setPollDates((dates) => [...dates, pollDateDraft].sort());
        setPollDateDraft('');
    };

    const removePollDate = (dateValue: string) => {
        setPollDates((dates) => dates.filter((date) => date !== dateValue));
    };

    const createPoll = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const trimmedTitle = pollTitle.trim();
        const trimmedDescription = pollDescription.trim();
        const groupId = Number(pollGroup);

        if (!trimmedTitle || !groupId || !pollDiscipline.trim() || selectedStudentIds.length === 0) {
            setServerMessage('Заполните тему, группу, дисциплину и выберите студентов.');
            return;
        }

        if (sortedPollDates.length < minPollDates || sortedPollDates.length > maxPollDates) {
            setServerMessage(`Выберите от ${minPollDates} до ${maxPollDates} дат для вариантов опроса.`);
            return;
        }

        if (sortedPollDates.some((dateValue) => dateValue < minimumPollDate)) {
            setServerMessage('Даты вариантов должны быть будущими.');
            return;
        }

        if (!apiReady) {
            setServerMessage('Сервер пока не готов. Обновите страницу и попробуйте ещё раз.');
            return;
        }

        const now = new Date();
        const deadlineAt = pollDeadline
            ? new Date(pollDeadline)
            : new Date(now.getTime() + 24 * 60 * 60 * 1000);

        if (deadlineAt.getTime() <= now.getTime()) {
            setServerMessage('Дедлайн должен быть позже текущей даты и времени.');
            return;
        }

        if (selectedSlots.length === 0) {
            setServerMessage('Выберите хотя бы один предложенный системой вариант времени.');
            return;
        }

        if (selectedSlots.some((slot) => slot.start.getTime() <= now.getTime())) {
            setServerMessage('Варианты времени должны быть позже текущей даты и времени.');
            return;
        }

        try {
            setServerMessage('');
            const createdPoll = await pollsApi.create({
                title: trimmedTitle,
                description: trimmedDescription || null,
                discipline: pollDiscipline.trim(),
                lessonType,
                deadlineAt: deadlineAt.toISOString(),
                targetGroupIds: [groupId],
                participantStudentIds: selectedStudentIds,
                options: selectedSlots.map((slot) => ({
                    startAt: slot.start.toISOString(),
                    endAt: slot.end.toISOString(),
                    durationMinutes: lessonDurationMinutes,
                    format: 'OFFLINE',
                    location: null,
                    link: null,
                })),
            });
            const activePoll = createdPoll.rawId ? await pollsApi.activate(createdPoll.rawId) : createdPoll;

            setPollsFromApi((items) => [{
                ...activePoll,
                isMine: true,
                teacherId: currentUser?.id,
            }, ...items]);
            setPollTitle('');
            setPollDescription('');
            setPollGroup('');
            setPollDiscipline('');
            setLessonType('консультация');
            setLessonDurationMinutes(90);
            setPollDeadline('');
            setPollDateDraft('');
            setPollDates([]);
            setGroupStudents([]);
            setSelectedStudentIds([]);
            setSelectedSlotIds([]);
            setHasManualSlotSelection(false);
            setIsStudentPickerOpen(false);
            setActiveFilter('active');
            setServerMessage('Опрос создан. Выбранные преподавателем варианты времени отправлены студентам.');
        } catch {
            setServerMessage('Не удалось создать опрос. Проверьте группу, дедлайн и расписание.');
        }
    };

    return (
        <PageLayout>
            <section className="page-section">
                <SectionHeader
                    eyebrow="Опросы"
                    title="Опросы для выбора времени"
                    description="Активные опросы показывают только текущее голосование, завершенные - только закрытые голосования."
                />

                <div className="pill-group">
                    {(Object.keys(filterLabels) as PollFilter[]).map((filterKey) => (
                        <button
                            key={filterKey}
                            type="button"
                            className={`button ${activeFilter === filterKey ? 'button--primary' : 'button--ghost'} button--sm`}
                            onClick={() => setActiveFilter(filterKey)}
                        >
                            {filterLabels[filterKey]}
                        </button>
                    ))}
                </div>

                {canCreatePolls ? (
                    <Card className="stack">
                        <div className="mini-stack">
                            <span className="eyebrow">Создание опроса</span>
                            <h2 className="detail-panel__title">Создать опрос для выбора времени</h2>
                            <p className="subtle-text">
                                Преподаватель выбирает свою дисциплину, затем группу из расписания, студентов группы и подходящие системные варианты.
                            </p>
                        </div>

                        <form className="form-grid" onSubmit={createPoll}>
                            <Input
                                label="Тема занятия"
                                value={pollTitle}
                                onChange={(event) => setPollTitle(event.target.value)}
                                placeholder="Например, консультация по проекту"
                            />
                            <Select
                                label="Дисциплина"
                                value={pollDiscipline}
                                onChange={(event) => {
                                    setPollDiscipline(event.target.value);
                                    setGroups([]);
                                    setPollGroup('');
                                    setGroupStudents([]);
                                    setSelectedStudentIds([]);
                                    setSelectedSlotIds([]);
                                    setHasManualSlotSelection(false);
                                    setIsStudentPickerOpen(false);
                                }}
                            >
                                <option value="">Выберите дисциплину</option>
                                {teachingDisciplines.map((discipline) => (
                                    <option key={discipline} value={discipline}>
                                        {discipline}
                                    </option>
                                ))}
                            </Select>
                            <Select
                                label="Учебная группа"
                                value={pollGroup}
                                disabled={!pollDiscipline}
                                onChange={(event) => {
                                    setPollGroup(event.target.value);
                                    setGroupStudents([]);
                                    setSelectedStudentIds([]);
                                    setSelectedSlotIds([]);
                                    setHasManualSlotSelection(false);
                                    setIsStudentPickerOpen(false);
                                }}
                            >
                                <option value="">
                                    {pollDiscipline ? 'Выберите группу' : 'Сначала выберите дисциплину'}
                                </option>
                                {groups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.description ? `${group.name} - ${group.description}` : group.name}
                                    </option>
                                ))}
                            </Select>
                            <Select
                                label="Тип занятия"
                                value={lessonType}
                                onChange={(event) => setLessonType(event.target.value as LessonType)}
                            >
                                {lessonTypes.map((item) => (
                                    <option value={item} key={item}>{item}</option>
                                ))}
                            </Select>
                            <Select
                                label="Продолжительность"
                                value={String(lessonDurationMinutes)}
                                onChange={(event) => {
                                    setLessonDurationMinutes(Number(event.target.value) as LessonDuration);
                                    setSelectedSlotIds([]);
                                    setHasManualSlotSelection(false);
                                }}
                            >
                                {lessonDurationOptions.map((duration) => (
                                    <option value={duration} key={duration}>{duration} минут</option>
                                ))}
                            </Select>
                            <Input
                                label="Дедлайн"
                                type="datetime-local"
                                value={pollDeadline}
                                onChange={(event) => setPollDeadline(event.target.value)}
                                min={toDateTimeLocalValue(new Date())}
                            />
                            <div className="stack">
                                <Input
                                    label="Дата вариантов"
                                    type="date"
                                    value={pollDateDraft}
                                    onChange={(event) => setPollDateDraft(event.target.value)}
                                    min={minimumPollDate}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={!canAddPollDate}
                                    onClick={addPollDate}
                                >
                                    Добавить дату
                                </Button>
                            </div>
                            <div className="form-grid__full">
                                <Textarea
                                    label="Описание занятия"
                                    value={pollDescription}
                                    onChange={(event) => setPollDescription(event.target.value)}
                                    placeholder="Какие вопросы нужно согласовать со студентами"
                                />
                            </div>

                            <div className="form-grid__full stack">
                                <div className="student-group__header">
                                    <div className="mini-stack">
                                        <h3 className="list-card__title">Даты вариантов</h3>
                                        <p className="subtle-text">Добавьте от 2 до 7 дат, затем отметьте подходящие варианты ниже.</p>
                                    </div>
                                    <span className="status-chip status-chip--warning">
                                        {sortedPollDates.length} из {maxPollDates}
                                    </span>
                                </div>
                                {sortedPollDates.length > 0 ? (
                                    <div className="pill-group">
                                        {sortedPollDates.map((dateValue) => (
                                            <button
                                                type="button"
                                                className="tag-chip tag-chip--date"
                                                key={dateValue}
                                                onClick={() => removePollDate(dateValue)}
                                            >
                                                {slotDateFormatter.format(new Date(`${dateValue}T00:00:00`))} убрать
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            {sortedPollDates.length > 0 && pollGroup ? (
                                <div className="form-grid__full stack">
                                    <div className="student-group__header">
                                        <div className="mini-stack">
                                            <h3 className="list-card__title">Предложенные системой варианты</h3>
                                            <p className="subtle-text">Отметьте подходящие варианты из предложенных системой по выбранным датам.</p>
                                        </div>
                                        <span className="status-chip status-chip--active">
                                            {selectedSlots.length} выбрано
                                        </span>
                                    </div>
                                    {suggestedSlots.length > 0 ? (
                                        <div className="check-list">
                                            {suggestedSlots.map((slot) => (
                                                <label className="check-item" key={slot.id}>
                                                    <input
                                                        type="checkbox"
                                                        checked={effectiveSelectedSlotIds.includes(slot.id)}
                                                        onChange={(event) => toggleSlot(slot.id, event.target.checked)}
                                                    />
                                                    <span>{slot.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="alert">
                                            Для выбранных дат нет будущих вариантов. Выберите более поздние даты.
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            {pollGroup ? (
                                <div className="form-grid__full record-item">
                                    <div className="student-group__header">
                                        <div className="mini-stack">
                                            <h3 className="record-item__title">Студенты группы</h3>
                                            <p className="record-item__meta">
                                                {selectedGroup?.name ?? 'Группа'} · выбрано {selectedStudentIds.length} из {groupStudents.length}
                                            </p>
                                        </div>
                                        <Button type="button" size="sm" variant="secondary" onClick={() => setIsStudentPickerOpen(true)}>
                                            Выбрать студентов
                                        </Button>
                                    </div>
                                </div>
                            ) : null}

                            <div className="form-grid__full">
                                {serverMessage ? <div className={serverMessage.includes('создан') ? 'alert alert--success' : 'alert'}>{serverMessage}</div> : null}
                                <Button type="submit">Отправить студентам</Button>
                            </div>
                        </form>

                        {isStudentPickerOpen && pollGroup ? (
                            <div className="modal" role="dialog" aria-modal="true">
                                <button
                                    className="modal__backdrop"
                                    type="button"
                                    aria-label="Закрыть выбор студентов"
                                    onClick={() => setIsStudentPickerOpen(false)}
                                />
                                <Card className="modal__card">
                                    <div className="modal__header">
                                        <div>
                                            <h2 className="modal__title">Выбор студентов</h2>
                                            <p className="modal__description">
                                                {selectedGroup?.name ?? 'Группа'} · {pollDiscipline}
                                            </p>
                                        </div>
                                        <Button className="modal__close" size="sm" variant="ghost" onClick={() => setIsStudentPickerOpen(false)}>
                                            Закрыть
                                        </Button>
                                    </div>

                                    <div className="student-group__header">
                                        <p className="subtle-text">Опрос будет отправлен только выбранным студентам.</p>
                                        <label className="check-item">
                                            <input
                                                type="checkbox"
                                                checked={allStudentsSelected}
                                                onChange={(event) => toggleAllStudents(event.target.checked)}
                                            />
                                            <span>Выбрать всех</span>
                                        </label>
                                    </div>

                                    <div className="check-list">
                                        {groupStudents.map((student) => (
                                            <label className="check-item" key={student.id}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedStudentIds.includes(student.id)}
                                                    onChange={(event) => toggleStudent(student.id, event.target.checked)}
                                                />
                                                <span>{student.name}</span>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="modal__footer">
                                        <span className="record-item__meta">Выбрано {selectedStudentIds.length} из {groupStudents.length}</span>
                                        <Button type="button" onClick={() => setIsStudentPickerOpen(false)}>
                                            Готово
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        ) : null}
                    </Card>
                ) : null}

                <div className="cards-grid cards-grid--two">
                    {visiblePolls.map((poll) => (
                        <Card className="poll-card" hoverable key={poll.id}>
                            <div className="mini-stack">
                                <span className={`status-chip ${statusClasses[poll.status]}`}>
                                    {statusLabels[poll.status]}
                                </span>
                                <h2 className="poll-card__title">{poll.title}</h2>
                                <p>{poll.description}</p>
                            </div>

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
                                    <span className={`meta-item__value ${isDeadlineUrgent(poll.deadline) ? 'deadline-text' : ''}`}>{poll.deadline}</span>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-item__label">Варианты</span>
                                    <span className="meta-item__value">{poll.optionsCount}</span>
                                </div>
                            </div>

                            <Link className="button button--secondary button--md" to={`/polls/${poll.id}`}>
                                Перейти
                            </Link>
                        </Card>
                    ))}
                </div>
            </section>
        </PageLayout>
    );
};
