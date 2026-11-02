import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { diplomaImportApi } from '@/shared/api/diploma-import.api';
import { eventsApi } from '@/shared/api/events.api';
import { groupsApi } from '@/shared/api/groups.api';
import type { StudyGroup } from '@/shared/api/polls.api';
import { usersApi, type AdminStats, type BackendUser } from '@/shared/api/users.api';
import { mockEvents, mockUsers } from '@/shared/lib/mock-data';
import { IS_DEMO } from '@/shared/demo/config';
import type { PlatformUser, UserRole } from '@/shared/types/user';
import { Button } from '@/shared/ui/button/Button';
import { Card } from '@/shared/ui/card/Card';
import { Input } from '@/shared/ui/input/Input';
import { RoleBadge } from '@/shared/ui/role-badge/RoleBadge';
import { SectionHeader } from '@/shared/ui/section-header/SectionHeader';
import { Select } from '@/shared/ui/select/Select';
import { StatCard } from '@/shared/ui/stat-card/StatCard';
import { Table, type TableColumn } from '@/shared/ui/table/Table';
import { Textarea } from '@/shared/ui/textarea/Textarea';
import { PageLayout } from '@/widgets/page-layout';

type QuickActionId = 'create-user' | 'users' | 'create-group' | 'groups';
type AdminModal = null | { type: 'user'; user: PlatformUser } | { type: 'group'; group: StudyGroup };
type AdminEventType = 'консультация' | 'мастер-класс' | 'лекция' | 'семинар' | 'другое';
type NoticeState = { type: 'idle' | 'success' | 'error'; text: string };

interface UserFormState {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    groupId: string;
}

interface UserEditFormState {
    name: string;
    email: string;
    role: UserRole;
    groupId: string;
}

interface GroupFormState {
    name: string;
    description: string;
    teacherId: string;
}

const emptyUserForm: UserFormState = {
    name: '',
    email: '',
    password: '',
    role: 'student',
    groupId: '',
};

const emptyGroupForm: GroupFormState = {
    name: '',
    description: '',
    teacherId: '',
};

const quickActions: Array<{ id: QuickActionId; title: string; description: string }> = [
    {
        id: 'create-user',
        title: 'Новый пользователь',
        description: 'Студент, преподаватель или администратор с паролем и ролью.',
    },
    {
        id: 'users',
        title: 'Пользователи',
        description: 'Данные, роли, статус активности и удаление учетной записи.',
    },
    {
        id: 'create-group',
        title: 'Новая группа',
        description: 'Название, описание и ответственный преподаватель.',
    },
    {
        id: 'groups',
        title: 'Учебные группы',
        description: 'Привязка студентов к выбранной группе.',
    },
];

const roleOptions: Array<{ value: UserRole; label: string }> = [
    { value: 'student', label: 'Студент' },
    { value: 'teacher', label: 'Преподаватель' },
    { value: 'admin', label: 'Администратор' },
];

const eventTypes: AdminEventType[] = ['консультация', 'мастер-класс', 'лекция', 'семинар', 'другое'];
const studentsWithoutGroupLabel = 'Без группы';

const statusClassName: Record<PlatformUser['status'], string> = {
    active: 'status-chip--active',
    review: 'status-chip--warning',
    offline: 'status-chip--closed',
};

const statusLabel: Record<PlatformUser['status'], string> = {
    active: 'Активен',
    review: 'Проверка',
    offline: 'Деактивирован',
};

const toPlatformUser = (user: BackendUser): PlatformUser => {
    const isActive = user.isActive ?? true;

    return {
        id: String(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
        group: user.group?.name,
        groupId: user.groupId ?? user.group?.id ?? null,
        isActive,
        status: isActive ? 'active' : 'offline',
    };
};

const toDateTimeValue = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60 * 1000;

    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const addDays = (date: Date, days: number) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);

    return nextDate;
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
        return error.response?.data?.message ?? error.message ?? fallback;
    }

    return fallback;
};

export const AdminPage = () => {
    const fallbackStats: AdminStats = useMemo(() => ({
        studentsCount: mockUsers.filter((user) => user.role === 'student').length,
        teachersCount: mockUsers.filter((user) => user.role === 'teacher').length,
        groupsCount: 12,
        pollsCount: 0,
        eventsCount: mockEvents.length,
    }), []);

    const [stats, setStats] = useState<AdminStats>(fallbackStats);
    const [users, setUsers] = useState<PlatformUser[]>(mockUsers);
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [notice, setNotice] = useState<NoticeState>({ type: 'idle', text: 'Данные готовы к управлению.' });
    const [activeModal, setActiveModal] = useState<AdminModal>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);

    const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
    const [userEditForm, setUserEditForm] = useState<UserEditFormState>({
        name: '',
        email: '',
        role: 'student',
        groupId: '',
    });
    const [groupForm, setGroupForm] = useState<GroupFormState>(emptyGroupForm);
    const [groupEditForm, setGroupEditForm] = useState<GroupFormState>(emptyGroupForm);
    const [studentPickerByGroup, setStudentPickerByGroup] = useState<Record<number, string>>({});
    const [isImporting, setIsImporting] = useState(false);

    const [eventTitle, setEventTitle] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [eventDiscipline, setEventDiscipline] = useState('');
    const [eventType, setEventType] = useState<AdminEventType>('консультация');
    const [eventTeacherId, setEventTeacherId] = useState('');
    const [eventGroupId, setEventGroupId] = useState('');
    const [eventStart, setEventStart] = useState(() => toDateTimeValue(addDays(new Date(), 1)));
    const [eventEnd, setEventEnd] = useState(() => toDateTimeValue(addDays(new Date(Date.now() + 90 * 60 * 1000), 1)));
    const [eventFormat, setEventFormat] = useState<'OFFLINE' | 'ONLINE'>('OFFLINE');
    const [eventPlace, setEventPlace] = useState('');
    const [eventMessage, setEventMessage] = useState('');

    const teachers = useMemo(() => users.filter((user) => user.role === 'teacher' && user.isActive !== false), [users]);
    const students = useMemo(() => users.filter((user) => user.role === 'student'), [users]);

    const studentsByGroupId = useMemo(() => {
        const result = new Map<number, PlatformUser[]>();

        students.forEach((student) => {
            if (!student.groupId) {
                return;
            }

            const list = result.get(student.groupId) ?? [];
            result.set(student.groupId, [...list, student]);
        });

        return result;
    }, [students]);

    const refreshAdminData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [loadedStats, loadedUsers, loadedGroups] = await Promise.all([
                usersApi.getAdminStats(),
                usersApi.list(),
                groupsApi.list(),
            ]);

            setStats(loadedStats);
            setUsers(loadedUsers.map(toPlatformUser));
            setGroups(loadedGroups);
        } catch (error) {
            setStats(fallbackStats);
            setUsers(mockUsers);
            setNotice({
                type: 'error',
                text: getErrorMessage(error, 'Не удалось загрузить данные админ-панели.'),
            });
        } finally {
            setIsLoading(false);
        }
    }, [fallbackStats]);

    useEffect(() => {
        void refreshAdminData();
    }, [refreshAdminData]);

    useEffect(() => {
        const handleScroll = () => {
            const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 420;
            setShowScrollTop(nearBottom);
        };

        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const openQuickAction = (actionId: QuickActionId) => {
        const targetByAction: Record<QuickActionId, string> = {
            'create-user': 'admin-user-form',
            users: 'admin-users-section',
            'create-group': 'admin-group-form',
            groups: 'admin-groups-section',
        };

        scrollToSection(targetByAction[actionId]);
    };

    const formatGroupTitle = useCallback((group: StudyGroup) => {
        if (!group.description || group.description === group.name) {
            return group.name;
        }

        return `${group.name} — ${group.description}`;
    }, []);

    const getStudentGroupLabel = useCallback((student: PlatformUser) => {
        const group = groups.find((item) => item.id === student.groupId);

        return group ? formatGroupTitle(group) : studentsWithoutGroupLabel;
    }, [formatGroupTitle, groups]);

    const getAssignableStudents = useCallback((groupId: number) => (
        students.filter((student) => student.isActive !== false && student.groupId !== groupId)
    ), [students]);

    const openUserEditor = useCallback((user: PlatformUser) => {
        setUserEditForm({
            name: user.name,
            email: user.email,
            role: user.role,
            groupId: user.groupId ? String(user.groupId) : '',
        });
        setActiveModal({ type: 'user', user });
    }, []);

    const openGroupEditor = useCallback((group: StudyGroup) => {
        setGroupEditForm({
            name: group.name,
            description: group.description ?? '',
            teacherId: group.teacherId ? String(group.teacherId) : '',
        });
        setActiveModal({ type: 'group', group });
    }, []);

    const userColumns: Array<TableColumn<PlatformUser>> = useMemo(() => [
        {
            key: 'name',
            header: 'Пользователь',
            render: (row) => (
                <div className="mini-stack">
                    <span className="quick-link__title">{row.name}</span>
                    <span className="subtle-text">{row.email}</span>
                </div>
            ),
        },
        {
            key: 'role',
            header: 'Роль',
            render: (row) => <RoleBadge role={row.role} />,
        },
        {
            key: 'group',
            header: 'Группа',
            render: (row) => (
                <span className="subtle-text">
                    {row.role === 'student' ? getStudentGroupLabel(row) : '—'}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Статус',
            render: (row) => <span className={`status-chip ${statusClassName[row.status]}`}>{statusLabel[row.status]}</span>,
        },
        {
            key: 'action',
            header: 'Действие',
            render: (row) => (
                <Button size="sm" variant="secondary" onClick={() => openUserEditor(row)}>
                    Редактировать
                </Button>
            ),
        },
    ], [getStudentGroupLabel, openUserEditor]);

    const createUser = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password.trim()) {
            setNotice({ type: 'error', text: 'Заполните имя, электронную почту и пароль пользователя.' });
            return;
        }

        try {
            await usersApi.createByAdmin({
                name: userForm.name.trim(),
                email: userForm.email.trim(),
                passHash: userForm.password,
                role: userForm.role,
                groupId: userForm.role === 'student' && userForm.groupId ? Number(userForm.groupId) : null,
            });

            setUserForm(emptyUserForm);
            setNotice({ type: 'success', text: 'Пользователь создан.' });
            await refreshAdminData();
        } catch (error) {
            setNotice({
                type: 'error',
                text: getErrorMessage(error, 'Не удалось создать пользователя.'),
            });
        }
    };

    const updateUser = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!activeModal || activeModal.type !== 'user') {
            return;
        }

        try {
            await usersApi.update(activeModal.user.id, {
                name: userEditForm.name.trim(),
                email: userEditForm.email.trim(),
                role: userEditForm.role,
                groupId: userEditForm.role === 'student' && userEditForm.groupId ? Number(userEditForm.groupId) : null,
            });

            setActiveModal(null);
            setNotice({ type: 'success', text: 'Данные пользователя обновлены.' });
            await refreshAdminData();
        } catch (error) {
            setNotice({
                type: 'error',
                text: getErrorMessage(error, 'Не удалось обновить пользователя.'),
            });
        }
    };

    const setUserActive = async (isActive: boolean) => {
        if (!activeModal || activeModal.type !== 'user') {
            return;
        }

        try {
            await usersApi.update(activeModal.user.id, { isActive });
            setActiveModal(null);
            setNotice({ type: 'success', text: isActive ? 'Учетная запись активирована.' : 'Учетная запись деактивирована.' });
            await refreshAdminData();
        } catch (error) {
            setNotice({
                type: 'error',
                text: getErrorMessage(error, 'Не удалось изменить статус учетной записи.'),
            });
        }
    };

    const deleteUser = async () => {
        if (!activeModal || activeModal.type !== 'user') {
            return;
        }

        const confirmed = window.confirm(`Удалить учетную запись "${activeModal.user.name}"?`);

        if (!confirmed) {
            return;
        }

        try {
            await usersApi.remove(activeModal.user.id);
            setActiveModal(null);
            setNotice({ type: 'success', text: 'Учетная запись удалена.' });
            await refreshAdminData();
        } catch (error) {
            setNotice({
                type: 'error',
                text: getErrorMessage(error, 'Не удалось удалить учетную запись.'),
            });
        }
    };

    const createGroup = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!groupForm.name.trim()) {
            setNotice({ type: 'error', text: 'Укажите название группы.' });
            return;
        }

        try {
            await groupsApi.create({
                name: groupForm.name.trim(),
                description: groupForm.description.trim() || 'Учебная группа',
                teacherId: groupForm.teacherId ? Number(groupForm.teacherId) : null,
            });

            setGroupForm(emptyGroupForm);
            setNotice({ type: 'success', text: 'Группа создана.' });
            await refreshAdminData();
        } catch (error) {
            setNotice({
                type: 'error',
                text: getErrorMessage(error, 'Не удалось создать группу.'),
            });
        }
    };

    const updateGroup = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!activeModal || activeModal.type !== 'group' || !groupEditForm.name.trim()) {
            return;
        }

        try {
            await groupsApi.update(activeModal.group.id, {
                name: groupEditForm.name.trim(),
                description: groupEditForm.description.trim() || 'Учебная группа',
                teacherId: groupEditForm.teacherId ? Number(groupEditForm.teacherId) : null,
            });

            setActiveModal(null);
            setNotice({ type: 'success', text: 'Группа обновлена.' });
            await refreshAdminData();
        } catch (error) {
            setNotice({
                type: 'error',
                text: getErrorMessage(error, 'Не удалось обновить группу.'),
            });
        }
    };

    const linkStudentToGroup = async (groupId: number) => {
        const selectedStudentId = studentPickerByGroup[groupId];

        if (!selectedStudentId) {
            return;
        }

        try {
            await groupsApi.addStudent(groupId, Number(selectedStudentId));
            setStudentPickerByGroup((current) => ({ ...current, [groupId]: '' }));
            setNotice({ type: 'success', text: 'Студент связан с группой.' });
            await refreshAdminData();
        } catch (error) {
            setNotice({
                type: 'error',
                text: getErrorMessage(error, 'Не удалось связать студента с группой.'),
            });
        }
    };

    const unlinkStudentFromGroup = async (groupId: number, studentId: string) => {
        try {
            await groupsApi.removeStudent(groupId, Number(studentId));
            setNotice({ type: 'success', text: 'Студент удален из группы.' });
            await refreshAdminData();
        } catch (error) {
            setNotice({
                type: 'error',
                text: getErrorMessage(error, 'Не удалось удалить студента из группы.'),
            });
        }
    };

    const importStudents = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        try {
            setIsImporting(true);
            setNotice({ type: 'idle', text: `Импортируем файл: ${file.name}...` });
            await diplomaImportApi.importDataset(file);
            setNotice({ type: 'success', text: 'Импорт завершен.' });
            await refreshAdminData();
        } catch (error) {
            setNotice({
                type: 'error',
                text: getErrorMessage(error, `Не удалось импортировать файл "${file.name}".`),
            });
        } finally {
            setIsImporting(false);
            event.target.value = '';
        }
    };

    const createAdminEvent = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!eventTitle.trim() || !eventDiscipline.trim() || !eventTeacherId || !eventStart || !eventEnd) {
            setEventMessage('Заполните название, дисциплину, преподавателя и время мероприятия.');
            return;
        }

        try {
            const link = eventFormat === 'ONLINE' ? eventPlace.trim() : '';
            await eventsApi.create({
                title: eventTitle.trim(),
                description: eventDescription.trim() || null,
                discipline: eventDiscipline.trim(),
                lessonType: eventType,
                teacherId: Number(eventTeacherId),
                groupId: eventGroupId ? Number(eventGroupId) : null,
                startAt: new Date(eventStart).toISOString(),
                endAt: new Date(eventEnd).toISOString(),
                format: eventFormat,
                location: null,
                link: link || null,
            });

            setStats((current) => ({ ...current, eventsCount: current.eventsCount + 1 }));
            setEventTitle('');
            setEventDescription('');
            setEventDiscipline('');
            setEventGroupId('');
            setEventPlace('');
            setEventMessage('Мероприятие создано.');
        } catch (error) {
            setEventMessage(getErrorMessage(error, 'Не удалось создать мероприятие.'));
        }
    };

    return (
        <PageLayout>
            <section className="page-section">
                <SectionHeader
                    eyebrow="Панель администратора"
                    title="Управление платформой"
                    description="Пользователи, роли, учетные записи и учебные группы."
                />

                <div className="stats-grid">
                    <StatCard eyebrow="Пользователи" label="Студенты" value={String(stats.studentsCount)} hint="Открыть пользователей." onClick={() => scrollToSection('admin-users-section')} />
                    <StatCard eyebrow="Преподаватели" label="Преподаватели" value={String(stats.teachersCount)} hint="Открыть пользователей." onClick={() => scrollToSection('admin-users-section')} />
                    <StatCard eyebrow="Группы" label="Группы" value={String(stats.groupsCount)} hint="Открыть группы." onClick={() => scrollToSection('admin-groups-section')} />
                    <StatCard eyebrow="Мероприятия" label="Мероприятия" value={String(stats.eventsCount)} hint="Создать событие." onClick={() => scrollToSection('admin-event-form')} />
                </div>

                <div className="action-grid">
                    {quickActions.map((action) => (
                        <Card className="action-card quick-link quick-link--button" hoverable key={action.id} onClick={() => openQuickAction(action.id)} role="button" tabIndex={0}>
                            <span className="eyebrow">Действие</span>
                            <h3 className="quick-link__title">{action.title}</h3>
                            <p>{action.description}</p>
                        </Card>
                    ))}
                </div>

                <p className={notice.type === 'idle' ? 'subtle-text' : `alert alert--${notice.type}`}>
                    {isLoading ? 'Обновляем данные...' : notice.text}
                </p>

                <div className="cards-grid cards-grid--two">
                    <Card className="stack" id="admin-user-form">
                        <div className="mini-stack">
                            <span className="eyebrow">Учётная запись</span>
                            <h2 className="list-card__title">Создать пользователя</h2>
                        </div>

                        <form className="form-grid" onSubmit={createUser}>
                            <Input label="Имя" value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} />
                            <Input label="Электронная почта" type="email" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} />
                            <Input label="Пароль" type="password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} />
                            <Select label="Роль" value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as UserRole, groupId: event.target.value === 'student' ? current.groupId : '' }))}>
                                {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                            </Select>
                            {userForm.role === 'student' ? (
                                <Select label="Группа" value={userForm.groupId} onChange={(event) => setUserForm((current) => ({ ...current, groupId: event.target.value }))}>
                                    <option value="">Без группы</option>
                                    {groups.map((group) => <option key={group.id} value={group.id}>{formatGroupTitle(group)}</option>)}
                                </Select>
                            ) : null}
                            <div className="form-grid__full">
                                <Button type="submit">Создать пользователя</Button>
                            </div>
                        </form>

                        <div className="mini-stack">
                            <Input label="Импорт набора из таблицы" type="file" accept=".xlsx,.xls,.csv" onChange={importStudents} disabled={IS_DEMO || isImporting} />
                            {IS_DEMO ? <p className="subtle-text">Импорт таблиц доступен в полной версии с сервером. В демо уже загружен тестовый набор.</p> : null}
                        </div>
                    </Card>

                    <Card className="stack" id="admin-group-form">
                        <div className="mini-stack">
                            <span className="eyebrow">Группа</span>
                            <h2 className="list-card__title">Создать группу</h2>
                        </div>

                        <form className="form-grid" onSubmit={createGroup}>
                            <Input label="Название" value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} placeholder="ИВТ-301" />
                            <Input label="Описание" value={groupForm.description} onChange={(event) => setGroupForm((current) => ({ ...current, description: event.target.value }))} placeholder="Информационные системы и технологии" />
                            <Select label="Преподаватель" value={groupForm.teacherId} onChange={(event) => setGroupForm((current) => ({ ...current, teacherId: event.target.value }))}>
                                <option value="">Не назначен</option>
                                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                            </Select>
                            <div className="form-grid__full">
                                <Button type="submit">Создать группу</Button>
                            </div>
                        </form>
                    </Card>
                </div>

                <section className="page-section" id="admin-users-section">
                    <div className="student-group__header">
                        <div className="mini-stack">
                            <h2 className="list-card__title">Пользователи</h2>
                            <p className="subtle-text">Всего: {users.length}</p>
                        </div>
                        <Button variant="secondary" onClick={() => void refreshAdminData()}>Обновить</Button>
                    </div>

                    <Table columns={userColumns} data={users} getRowKey={(row) => row.id} />
                </section>

                <section className="page-section" id="admin-groups-section">
                    <div className="mini-stack">
                        <h2 className="list-card__title">Учебные группы</h2>
                        <p className="subtle-text">Групп: {groups.length}</p>
                    </div>

                    {groups.length > 0 ? (
                        <div className="student-groups">
                            {groups.map((group) => {
                                const groupStudents = studentsByGroupId.get(group.id) ?? [];
                                const assignableStudents = getAssignableStudents(group.id);
                                const selectedStudentId = studentPickerByGroup[group.id] ?? '';

                                return (
                                    <Card className="student-group" key={group.id}>
                                        <div className="student-group__header">
                                            <div className="mini-stack">
                                                <span className="eyebrow">Группа</span>
                                                <h3 className="student-group__title">{formatGroupTitle(group)}</h3>
                                            </div>
                                            <span className="status-chip status-chip--active">{groupStudents.length}</span>
                                        </div>

                                        <div className="student-list">
                                            {groupStudents.length > 0 ? groupStudents.map((student) => (
                                                <div className="student-row" key={student.id}>
                                                    <div className="student-row__main">
                                                        <span className="quick-link__title">{student.name}</span>
                                                        <span className="subtle-text">{student.email}</span>
                                                    </div>
                                                    <div className="student-row__actions">
                                                        <span className={`status-chip ${statusClassName[student.status]}`}>{statusLabel[student.status]}</span>
                                                        <Button size="sm" variant="ghost" onClick={() => void unlinkStudentFromGroup(group.id, student.id)}>
                                                            Убрать
                                                        </Button>
                                                    </div>
                                                </div>
                                            )) : (
                                                <p className="subtle-text">Студенты не назначены.</p>
                                            )}
                                        </div>

                                        <div className="group-student-picker">
                                            <Select label="Студент" value={selectedStudentId} onChange={(event) => setStudentPickerByGroup((current) => ({ ...current, [group.id]: event.target.value }))}>
                                                <option value="">Выберите студента</option>
                                                {assignableStudents.map((student) => (
                                                    <option key={student.id} value={student.id}>
                                                        {student.name} · {getStudentGroupLabel(student)}
                                                    </option>
                                                ))}
                                            </Select>
                                            <Button variant="secondary" onClick={() => void linkStudentToGroup(group.id)} disabled={!selectedStudentId}>
                                                Связать
                                            </Button>
                                        </div>

                                        <Button variant="secondary" onClick={() => openGroupEditor(group)}>
                                            Изменить группу
                                        </Button>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <Card className="empty-state">
                            <h3 className="empty-state__title">Групп пока нет</h3>
                        </Card>
                    )}
                </section>

                <Card className="stack" id="admin-event-form">
                    <div className="mini-stack">
                        <span className="eyebrow">Мероприятие администратора</span>
                        <h2 className="list-card__title">Создать мероприятие</h2>
                    </div>

                    <form className="form-grid" onSubmit={createAdminEvent}>
                        <Input label="Название" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Консультация по диплому" />
                        <Input label="Дисциплина" value={eventDiscipline} onChange={(event) => setEventDiscipline(event.target.value)} placeholder="Проектная практика" />
                        <Select label="Тип мероприятия" value={eventType} onChange={(event) => setEventType(event.target.value as AdminEventType)}>
                            {eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </Select>
                        <Select label="Преподаватель" value={eventTeacherId} onChange={(event) => setEventTeacherId(event.target.value)}>
                            <option value="">Выберите преподавателя</option>
                            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                        </Select>
                        <Select label="Группа" value={eventGroupId} onChange={(event) => setEventGroupId(event.target.value)}>
                            <option value="">Без группы</option>
                            {groups.map((group) => <option key={group.id} value={group.id}>{formatGroupTitle(group)}</option>)}
                        </Select>
                        <Select label="Формат" value={eventFormat} onChange={(event) => setEventFormat(event.target.value as 'OFFLINE' | 'ONLINE')}>
                            <option value="OFFLINE">Очно</option>
                            <option value="ONLINE">Онлайн</option>
                        </Select>
                        <Input label="Начало" type="datetime-local" value={eventStart} onChange={(event) => setEventStart(event.target.value)} />
                        <Input label="Окончание" type="datetime-local" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} />
                        {eventFormat === 'ONLINE' ? (
                            <Input label="Ссылка" value={eventPlace} onChange={(event) => setEventPlace(event.target.value)} placeholder="https://meet..." />
                        ) : null}
                        <div className="form-grid__full">
                            <Textarea label="Описание" value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} placeholder="Короткое описание для студентов и преподавателя" />
                        </div>
                        <div className="form-grid__full">
                            {eventMessage ? <p className={eventMessage.includes('создано') ? 'alert alert--success' : 'alert alert--error'}>{eventMessage}</p> : null}
                            <Button type="submit">Создать мероприятие</Button>
                        </div>
                    </form>
                </Card>
            </section>

            {showScrollTop ? (
                <Button className="scroll-top-button" aria-label="Наверх" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    ↑
                </Button>
            ) : null}

            {activeModal?.type === 'user' ? (
                <div className="modal" role="dialog" aria-modal="true">
                    <button className="modal__backdrop" type="button" aria-label="Закрыть" onClick={() => setActiveModal(null)} />
                    <Card className="modal__card">
                        <div className="modal__header">
                            <h2 className="modal__title">Редактировать пользователя</h2>
                            <p className="modal__description">{activeModal.user.email}</p>
                        </div>
                        <Button className="modal__close" size="sm" variant="ghost" onClick={() => setActiveModal(null)}>Закрыть</Button>

                        <form className="form-grid" onSubmit={updateUser}>
                            <Input label="Имя" value={userEditForm.name} onChange={(event) => setUserEditForm((current) => ({ ...current, name: event.target.value }))} />
                            <Input label="Электронная почта" type="email" value={userEditForm.email} onChange={(event) => setUserEditForm((current) => ({ ...current, email: event.target.value }))} />
                            <Select label="Роль" value={userEditForm.role} onChange={(event) => setUserEditForm((current) => ({ ...current, role: event.target.value as UserRole, groupId: event.target.value === 'student' ? current.groupId : '' }))}>
                                {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                            </Select>
                            {userEditForm.role === 'student' ? (
                                <Select label="Группа" value={userEditForm.groupId} onChange={(event) => setUserEditForm((current) => ({ ...current, groupId: event.target.value }))}>
                                    <option value="">Без группы</option>
                                    {groups.map((group) => <option key={group.id} value={group.id}>{formatGroupTitle(group)}</option>)}
                                </Select>
                            ) : null}
                            <div className="form-grid__full modal__footer">
                                <Button type="submit">Сохранить</Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => void setUserActive(activeModal.user.isActive === false)}
                                >
                                    {activeModal.user.isActive === false ? 'Активировать' : 'Деактивировать'}
                                </Button>
                            </div>
                        </form>

                        <div className="danger-zone">
                            <div className="mini-stack">
                                <h3 className="record-item__title">Учетная запись</h3>
                                <p className="subtle-text">Удаление уберет пользователя из системы.</p>
                            </div>
                            <Button variant="danger" onClick={() => void deleteUser()}>
                                Удалить учетную запись
                            </Button>
                        </div>
                    </Card>
                </div>
            ) : null}

            {activeModal?.type === 'group' ? (
                <div className="modal" role="dialog" aria-modal="true">
                    <button className="modal__backdrop" type="button" aria-label="Закрыть" onClick={() => setActiveModal(null)} />
                    <Card className="modal__card">
                        <div className="modal__header">
                            <h2 className="modal__title">Редактировать группу</h2>
                            <p className="modal__description">{formatGroupTitle(activeModal.group)}</p>
                        </div>
                        <Button className="modal__close" size="sm" variant="ghost" onClick={() => setActiveModal(null)}>Закрыть</Button>
                        <form className="form-grid" onSubmit={updateGroup}>
                            <Input label="Название" value={groupEditForm.name} onChange={(event) => setGroupEditForm((current) => ({ ...current, name: event.target.value }))} />
                            <Input label="Описание" value={groupEditForm.description} onChange={(event) => setGroupEditForm((current) => ({ ...current, description: event.target.value }))} />
                            <Select label="Преподаватель" value={groupEditForm.teacherId} onChange={(event) => setGroupEditForm((current) => ({ ...current, teacherId: event.target.value }))}>
                                <option value="">Не назначен</option>
                                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                            </Select>
                            <div className="form-grid__full">
                                <Button type="submit">Сохранить изменения</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            ) : null}
        </PageLayout>
    );
};
