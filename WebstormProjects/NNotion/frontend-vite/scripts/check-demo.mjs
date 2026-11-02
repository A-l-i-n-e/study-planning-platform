import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Exercise the existing API modules against the demo adapter, without a backend.
const memoryStorage = () => {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
    };
};
globalThis.localStorage = memoryStorage();
globalThis.sessionStorage = memoryStorage();
localStorage.setItem('authUser', 'ordinary-session-is-preserved');
const server = await createServer({ mode: 'demo', server: { middlewareMode: true }, appType: 'custom' });
try {
    const load = (path) => server.ssrLoadModule(`/src/shared/${path}`);
    const { tokenStorage } = await load('lib/token-storage.tsx');
    const { getDemoUser } = await load('demo/adapter.ts');
    const { demoDate, demoDateKey, createDemoTasks } = await load('demo/data.ts');
    const { api } = await load('api/base.ts');
    const { pollsApi } = await load('api/polls.api.ts');
    const { eventsApi } = await load('api/events.api.ts');
    const { usersApi } = await load('api/users.api.ts');
    const { groupsApi } = await load('api/groups.api.ts');
    const { notificationsApi } = await load('api/notifications.api.ts');
    const selectRole = (role) => { tokenStorage.clearAuth(); tokenStorage.setUser(getDemoUser(role)); };
    const rejectsWithStatus = (operation, status) => assert.rejects(operation, (error) => error.response?.status === status);

    selectRole('student');
    assert.equal(tokenStorage.getAccessToken(), null, 'No authentication token is needed');
    const studentPolls = await pollsApi.list();
    assert.ok(studentPolls.length >= 3 && studentPolls.every((poll) => poll.status !== 'draft' && poll.group === 'ИВТ-301'));
    const activePoll = studentPolls.find((poll) => poll.status === 'active');
    const details = await pollsApi.getById(activePoll.id);
    assert.equal(details.options.length, 3);
    await pollsApi.clearVote(activePoll.id);
    assert.deepEqual((await pollsApi.getById(activePoll.id)).selectedOptionIds, []);
    await pollsApi.vote(activePoll.id, [details.options[1].rawId]);
    assert.deepEqual((await pollsApi.getById(activePoll.id)).selectedOptionIds, [details.options[1].id]);
    await rejectsWithStatus(() => pollsApi.getById(4), 403);
    await rejectsWithStatus(() => usersApi.getAdminStats(), 403);
    const studentEvents = await eventsApi.list();
    assert.ok(studentEvents.length >= 6 && studentEvents.every((event) => event.group === 'ИВТ-301'));
    assert.ok(studentEvents.some((event) => event.dateKey === demoDateKey(demoDate(0))));
    assert.equal(createDemoTasks('student')[demoDateKey(demoDate(0))].length, 2);
    const notes = await notificationsApi.mine();
    assert.ok(notes.length >= 5);
    await notificationsApi.markRead(notes[0].id);
    assert.ok((await notificationsApi.mine())[0].readAt);

    selectRole('teacher');
    assert.ok((await pollsApi.list()).every((poll) => poll.teacherId === 201));
    assert.ok((await groupsApi.teachingDisciplines()).length >= 2);
    assert.ok((await groupsApi.byDiscipline('Базы данных')).length >= 2);
    assert.ok((await groupsApi.students(1)).length >= 6);
    const recommendations = await pollsApi.getRecommendations(5);
    assert.equal(recommendations.length, 3);
    assert.ok(recommendations[0].passedThreshold);
    const beforeEvents = (await eventsApi.list()).length;
    await pollsApi.approveResult(5, recommendations[0].rawOptionId);
    assert.equal((await eventsApi.list()).length, beforeEvents + 1);
    await rejectsWithStatus(() => pollsApi.approveResult(5, recommendations[0].rawOptionId), 400);
    const createdPoll = await pollsApi.create({
        title: 'Демонстрационная консультация', lessonType: 'консультация', deadlineAt: demoDate(2, 18),
        discipline: 'Базы данных', targetGroupIds: [1], participantStudentIds: [101, 102],
        options: [3, 4].map((day) => ({ startAt: demoDate(day, 10), endAt: demoDate(day, 11, 30), format: 'OFFLINE', location: '204' })),
    });
    assert.equal((await pollsApi.activate(createdPoll.id)).status, 'active');
    await eventsApi.create({ title: 'Проверка нового события', lessonType: 'семинар', groupId: 1, startAt: demoDate(1, 16), endAt: demoDate(1, 17), format: 'OFFLINE', location: '312' });
    assert.ok((await eventsApi.list()).some((event) => event.title === 'Проверка нового события' && event.place === '312'));
    selectRole('student');
    assert.ok((await pollsApi.list()).some((poll) => poll.id === createdPoll.id));
    assert.deepEqual((await pollsApi.getById(activePoll.id)).selectedOptionIds, [details.options[1].id], 'Votes survive role switching');

    selectRole('admin');
    const stats = await usersApi.getAdminStats();
    assert.ok(stats.studentsCount >= 18 && stats.groupsCount >= 3);
    const createdUser = await usersApi.createByAdmin({ name: 'Тестовый студент', email: 'test@example.com', passHash: 'not-a-real-password', role: 'student' });
    assert.equal(createdUser.role, 'student');
    const group = await groupsApi.create({ name: 'ИВТ-305', description: 'Тестовая группа', teacherId: 201 });
    await groupsApi.update(group.id, { description: 'Обновлённое описание' });
    await groupsApi.addStudent(group.id, createdUser.id);
    assert.ok((await groupsApi.students(group.id)).some((student) => student.id === createdUser.id));
    await groupsApi.removeStudent(group.id, createdUser.id);
    await usersApi.update(createdUser.id, { isActive: false });
    assert.equal((await usersApi.list({ isActive: false })).find((user) => user.id === createdUser.id)?.isActive, false);
    await usersApi.remove(createdUser.id);
    assert.ok(!(await usersApi.list()).some((user) => user.id === createdUser.id));
    await rejectsWithStatus(() => usersApi.remove(101), 400);
    await rejectsWithStatus(() => api.post('/admin/import-diploma', {}), 400);
    await rejectsWithStatus(() => api.post('/users/change-password', {}), 400);
    await rejectsWithStatus(() => api.get('/unknown-demo-route'), 501);
    await rejectsWithStatus(() => api.get('https://example.invalid/api'), 501);
    tokenStorage.clearAuth();
    assert.equal(localStorage.getItem('authUser'), 'ordinary-session-is-preserved');
    assert.equal(tokenStorage.getUser(), null);
    console.log('Demo checks passed: three roles, scoped data, votes, recommendations, events, notifications, user/group CRUD and no HTTP fallback.');
} finally {
    await server.close();
}
