import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "../config/prisma";
import { events_format, events_status, poll_options_format, polls_status, users_role } from "../../generated/prisma/enums";
import { AppError } from "../errors/app-error";

type SheetRow = Record<string, unknown>;

type ImportSummary = {
    users: { created: number; updated: number };
    groups: { created: number; updated: number };
    studentsAssigned: number;
    polls: { created: number; skipped: number };
    votes: { created: number; skipped: number };
    events: { created: number; skipped: number };
    defaultPasswords: Record<users_role, string>;
    errors: Array<{ sheet: string; row?: number; message: string }>;
};

type FlexibleStudentRow = {
    email: string;
    name: string;
    groupName: string;
    password?: string;
    sheet: string;
    row: number;
};

const DEFAULT_PASSWORDS: Record<users_role, string> = {
    [users_role.admin]: "admin123",
    [users_role.teacher]: "teacher123",
    [users_role.student]: "student123",
};

const toText = (value: unknown) => String(value ?? "").trim();

const toRole = (value: unknown): users_role | null => {
    const role = toText(value).toLowerCase();

    if (role === users_role.admin || role === users_role.teacher || role === users_role.student) {
        return role as users_role;
    }

    return null;
};

const toFullName = (row: SheetRow) =>
    [row.last_name, row.first_name, row.middle_name]
        .map(toText)
        .filter(Boolean)
        .join(" ");

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const generatedEmailFor = (name: string, row: number) => {
    const hash = createHash("sha1").update(`${name}:${row}`).digest("hex").slice(0, 10);

    return `import-${hash}@local.demo`;
};

const toDateTime = (dateValue: unknown, timeValue: unknown, fallbackHour = 12) => {
    const dateText = toText(dateValue);
    const timeText = toText(timeValue);
    const [year, month, day] = dateText.split("-").map(Number);

    if (!year || !month || !day) {
        return null;
    }

    const [hour = fallbackHour, minute = 0] = timeText.split(":").map(Number);

    return new Date(year, month - 1, day, Number.isFinite(hour) ? hour : fallbackHour, Number.isFinite(minute) ? minute : 0);
};

const dayOffsets: Record<string, number> = {
    "понедельник": 0,
    "вторник": 1,
    "среда": 2,
    "четверг": 3,
    "пятница": 4,
    "суббота": 5,
    "воскресенье": 6,
};

const nextMonday = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const day = date.getDay() || 7;
    const daysUntilMonday = day === 1 ? 0 : 8 - day;
    date.setDate(date.getDate() + daysUntilMonday);

    return date;
};

const parseScheduleTime = (value: unknown) => {
    const [startText, endText] = toText(value)
        .replace("—", "-")
        .replace("–", "-")
        .split("-")
        .map((item) => item.trim());

    if (!startText || !endText) {
        return null;
    }

    const toParts = (time: string) => {
        const [hours, minutes] = time.split(":").map(Number);

        return Number.isFinite(hours) && Number.isFinite(minutes) ? { hours, minutes } : null;
    };

    const start = toParts(startText);
    const end = toParts(endText);

    if (!start || !end) {
        return null;
    }

    return { start, end };
};

export class DiplomaImportService {
    async importFromWorkbook(fileBuffer: Buffer): Promise<ImportSummary> {
        const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: false });
        const usersRows = this.sheetRows(workbook, "Users", ["user_id", "role", "email"]);
        const teachersRows = this.sheetRows(workbook, "Teachers", ["teacher_id", "user_id", "email"]);
        const groupsRows = this.sheetRows(workbook, "Groups", ["group_id", "group_name"]);
        const studentsRows = this.sheetRows(workbook, "Students", ["student_id", "email", "group_name"]);
        const pollRows = this.sheetRows(workbook, "Poll_Example", ["poll_id", "title"]);
        const votesRows = this.sheetRows(workbook, "Votes", ["vote_id", "poll_id", "student_id", "option_id"]);
        const scheduleRows = this.sheetRows(workbook, "Общее расписание", ["Неделя", "День", "Время", "Группа", "Предмет", "Преподаватель"]);

        const summary: ImportSummary = {
            users: { created: 0, updated: 0 },
            groups: { created: 0, updated: 0 },
            studentsAssigned: 0,
            polls: { created: 0, skipped: 0 },
            votes: { created: 0, skipped: 0 },
            events: { created: 0, skipped: 0 },
            defaultPasswords: DEFAULT_PASSWORDS,
            errors: [],
        };

        const passwordHashes = {
            [users_role.admin]: await bcrypt.hash(DEFAULT_PASSWORDS.admin, 10),
            [users_role.teacher]: await bcrypt.hash(DEFAULT_PASSWORDS.teacher, 10),
            [users_role.student]: await bcrypt.hash(DEFAULT_PASSWORDS.student, 10),
        };

        if (usersRows.length === 0 && scheduleRows.length > 0) {
            await this.importInitialSchedule(scheduleRows, passwordHashes.teacher, summary);
            return summary;
        }

        if (usersRows.length === 0 || groupsRows.length === 0 || studentsRows.length === 0) {
            const flexibleRows = studentsRows.length > 0
                ? this.normalizeStudentRows(studentsRows, "Students")
                : this.flexibleStudentRows(workbook);

            if (flexibleRows.length > 0) {
                await this.importFlexibleStudents(flexibleRows, passwordHashes.student, summary);
                return summary;
            }

            throw new AppError(
                `Табличный файл должен содержать данные студентов. Простой файл может содержать один столбец с именами или два столбца с именем и электронной почтой. Найденные листы: ${workbook.SheetNames.join(", ") || "нет"}`,
                400,
            );
        }

        const userIdByExternalId = new Map<string, number>();
        const userIdByEmail = new Map<string, number>();

        for (const [index, row] of usersRows.entries()) {
            const email = toText(row.email).toLowerCase();
            const role = toRole(row.role);
            const name = toFullName(row);
            const externalUserId = toText(row.user_id);

            if (!email || !role || !name) {
                summary.errors.push({ sheet: "Пользователи", row: index + 2, message: "Не указана электронная почта, роль или имя" });
                continue;
            }

            const existing = await prisma.users.findUnique({ where: { email }, select: { id: true } });
            const user = await prisma.users.upsert({
                where: { email },
                update: {
                    name,
                    role,
                    passHash: passwordHashes[role],
                    ...(role !== users_role.student ? { groupId: null } : {}),
                },
                create: {
                    email,
                    name,
                    role,
                    passHash: passwordHashes[role],
                },
                select: { id: true },
            });

            if (existing) {
                summary.users.updated += 1;
            } else {
                summary.users.created += 1;
            }

            if (externalUserId) {
                userIdByExternalId.set(externalUserId, user.id);
            }
            userIdByEmail.set(email, user.id);
        }

        const teacherUserIdByExternalTeacherId = new Map<string, number>();

        for (const [index, row] of teachersRows.entries()) {
            const teacherId = toText(row.teacher_id);
            const userId = userIdByExternalId.get(toText(row.user_id)) ?? userIdByEmail.get(toText(row.email).toLowerCase());

            if (!teacherId || !userId) {
                summary.errors.push({ sheet: "Преподаватели", row: index + 2, message: "Не удалось связать преподавателя с пользователем" });
                continue;
            }

            teacherUserIdByExternalTeacherId.set(teacherId, userId);
        }

        const groupIdByExternalId = new Map<string, number>();
        const groupIdByName = new Map<string, number>();

        for (const [index, row] of groupsRows.entries()) {
            const externalGroupId = toText(row.group_id);
            const name = toText(row.group_name);
            const description = [
                toText(row.specialization),
                toText(row.course) ? `${toText(row.course)} курс` : "",
            ].filter(Boolean).join(", ") || "Учебная группа";

            if (!externalGroupId || !name) {
                summary.errors.push({ sheet: "Группы", row: index + 2, message: "Не указан номер или название группы" });
                continue;
            }

            const existing = await prisma.study_groups.findFirst({ where: { name }, select: { id: true } });
            const group = existing
                ? await prisma.study_groups.update({
                    where: { id: existing.id },
                    data: { description },
                    select: { id: true },
                })
                : await prisma.study_groups.create({
                    data: { name, description },
                    select: { id: true },
                });

            if (existing) {
                summary.groups.updated += 1;
            } else {
                summary.groups.created += 1;
            }

            groupIdByExternalId.set(externalGroupId, group.id);
            groupIdByName.set(name.toLowerCase(), group.id);
        }

        const studentUserIdByExternalStudentId = new Map<string, number>();

        for (const [index, row] of studentsRows.entries()) {
            const email = toText(row.email).toLowerCase();
            const name = toFullName(row);
            const externalStudentId = toText(row.student_id);
            const groupId = groupIdByExternalId.get(toText(row.group_id)) ?? groupIdByName.get(toText(row.group_name).toLowerCase());

            if (!email || !name || !groupId || !externalStudentId) {
                summary.errors.push({ sheet: "Студенты", row: index + 2, message: "Не указана электронная почта, имя, номер студента или группа" });
                continue;
            }

            const user = await prisma.users.upsert({
                where: { email },
                update: {
                    name,
                    role: users_role.student,
                    passHash: passwordHashes.student,
                    groupId,
                },
                create: {
                    email,
                    name,
                    role: users_role.student,
                    passHash: passwordHashes.student,
                    groupId,
                },
                select: { id: true },
            });

            studentUserIdByExternalStudentId.set(externalStudentId, user.id);
            userIdByEmail.set(email, user.id);
            summary.studentsAssigned += 1;
        }

        await this.importPollExample(
            pollRows,
            votesRows,
            teacherUserIdByExternalTeacherId,
            groupIdByExternalId,
            studentUserIdByExternalStudentId,
            summary,
        );

        if (scheduleRows.length > 0) {
            await this.importInitialSchedule(scheduleRows, passwordHashes.teacher, summary);
        }

        return summary;
    }

    private sheetRows(workbook: XLSX.WorkBook, preferredSheetName: string, requiredColumns: string[]): SheetRow[] {
        const sheetName = this.findSheetName(workbook, preferredSheetName, requiredColumns);

        if (!sheetName) {
            return [];
        }

        const sheet = workbook.Sheets[sheetName];

        if (!sheet) {
            return [];
        }

        return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "" });
    }

    private findSheetName(workbook: XLSX.WorkBook, preferredSheetName: string, requiredColumns: string[]) {
        const exactMatch = workbook.SheetNames.find((sheetName) =>
            sheetName.trim().toLowerCase() === preferredSheetName.trim().toLowerCase()
        );

        if (exactMatch) {
            return exactMatch;
        }

        return workbook.SheetNames.find((sheetName) => {
            const rows = XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName], {
                defval: "",
                range: 0,
                raw: false,
            });
            const firstRow = rows[0];

            if (!firstRow) {
                return false;
            }

            const columns = new Set(Object.keys(firstRow).map((column) => column.trim().toLowerCase()));

            return requiredColumns.every((column) => columns.has(column.toLowerCase()));
        });
    }

    private normalizeStudentRows(rows: SheetRow[], sheet: string): FlexibleStudentRow[] {
        return rows.flatMap((row, index) => {
            const name = toFullName(row)
                || toText(row.name)
                || toText(row.full_name)
                || toText(row.fio)
                || toText(row["фио"])
                || toText(row["имя"]);
            const email = toText(row.email)
                || toText(row.mail)
                || toText(row["почта"]);
            const groupName = toText(row.group_name)
                || toText(row.group)
                || toText(row["группа"])
                || "Импортированная группа";

            if (!name && !email) {
                return [];
            }

            const finalName = name || email.split("@")[0] || `Студент ${index + 1}`;
            const finalEmail = isEmail(email) ? email.toLowerCase() : generatedEmailFor(finalName, index + 2);

            return [{
                email: finalEmail,
                name: finalName,
                groupName,
                password: toText(row.password) || undefined,
                sheet,
                row: index + 2,
            }];
        });
    }

    private flexibleStudentRows(workbook: XLSX.WorkBook): FlexibleStudentRow[] {
        for (const sheetName of workbook.SheetNames) {
            const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
                header: 1,
                defval: "",
            });
            const nonEmptyRows = rows
                .map((row) => row.map(toText))
                .filter((row) => row.some(Boolean));

            if (nonEmptyRows.length === 0) {
                continue;
            }

            const [firstRow, ...restRows] = nonEmptyRows;
            const normalizedHeader = firstRow.map((cell) => cell.toLowerCase());
            const hasHeader = normalizedHeader.some((cell) =>
                ["email", "mail", "почта", "name", "full_name", "fio", "фио", "имя", "group", "group_name", "группа"].includes(cell)
            );

            if (hasHeader) {
                const header = normalizedHeader;
                const sheetRows = restRows.map((row) => header.reduce<SheetRow>((acc, column, index) => {
                    acc[column] = row[index] ?? "";
                    return acc;
                }, {}));
                const normalizedRows = this.normalizeStudentRows(sheetRows, sheetName);

                if (normalizedRows.length > 0) {
                    return normalizedRows;
                }
            }

            const simpleRows = (hasHeader ? restRows : nonEmptyRows).flatMap((row, index) => {
                const cells = row.filter(Boolean);

                if (cells.length === 0) {
                    return [];
                }

                const emailCell = cells.find(isEmail) ?? "";
                const nameCell = cells.find((cell) => cell !== emailCell) ?? emailCell.split("@")[0] ?? "";
                const groupCell = cells.find((cell) => cell !== emailCell && cell !== nameCell) ?? "Импортированная группа";
                const name = nameCell || `Студент ${index + 1}`;

                return [{
                    email: emailCell ? emailCell.toLowerCase() : generatedEmailFor(name, index + 2),
                    name,
                    groupName: groupCell,
                    sheet: sheetName,
                    row: index + 2,
                }];
            });

            if (simpleRows.length > 0) {
                return simpleRows;
            }
        }

        return [];
    }

    private async importFlexibleStudents(rows: FlexibleStudentRow[], studentPassHash: string, summary: ImportSummary) {
        const groupIdByName = new Map<string, number>();

        for (const row of rows) {
            const groupName = row.groupName || "Импортированная группа";
            let groupId = groupIdByName.get(groupName.toLowerCase());

            if (!groupId) {
                const existingGroup = await prisma.study_groups.findFirst({
                    where: { name: groupName },
                    select: { id: true },
                });
                const group = existingGroup
                    ? await prisma.study_groups.update({
                        where: { id: existingGroup.id },
                        data: { description: "Группа из импортированного табличного файла" },
                        select: { id: true },
                    })
                    : await prisma.study_groups.create({
                        data: {
                            name: groupName,
                            description: "Группа из импортированного табличного файла",
                        },
                        select: { id: true },
                    });

                if (existingGroup) {
                    summary.groups.updated += 1;
                } else {
                    summary.groups.created += 1;
                }

                groupId = group.id;
                groupIdByName.set(groupName.toLowerCase(), groupId);
            }

            const existingUser = await prisma.users.findUnique({
                where: { email: row.email },
                select: { id: true, role: true },
            });

            if (existingUser && existingUser.role !== users_role.student) {
                summary.errors.push({
                    sheet: row.sheet,
                    row: row.row,
                    message: "Электронная почта принадлежит пользователю без роли студента, строка пропущена",
                });
                continue;
            }

            await prisma.users.upsert({
                where: { email: row.email },
                update: {
                    name: row.name,
                    role: users_role.student,
                    groupId,
                    ...(row.password ? { passHash: await bcrypt.hash(row.password, 10) } : {}),
                },
                create: {
                    email: row.email,
                    name: row.name,
                    role: users_role.student,
                    groupId,
                    passHash: row.password ? await bcrypt.hash(row.password, 10) : studentPassHash,
                },
            });

            if (existingUser) {
                summary.users.updated += 1;
            } else {
                summary.users.created += 1;
            }

            summary.studentsAssigned += 1;
        }
    }

    private async importInitialSchedule(rows: SheetRow[], teacherPassHash: string, summary: ImportSummary) {
        const baseMonday = nextMonday();

        for (const [index, row] of rows.entries()) {
            const week = toText(row["Неделя"]).toLowerCase();
            const day = toText(row["День"]).toLowerCase();
            const groupName = toText(row["Группа"]);
            const course = toText(row["Курс"]);
            const subject = toText(row["Предмет"]);
            const teacherName = toText(row["Преподаватель"]);
            const lessonType = toText(row["Тип занятия"]) || "другое";
            const time = parseScheduleTime(row["Время"]);
            const dayOffset = dayOffsets[day];

            if (!week || dayOffset === undefined || !groupName || !subject || !teacherName || !time) {
                summary.errors.push({ sheet: "Общее расписание", row: index + 2, message: "Не указана неделя, день, время, группа, предмет или преподаватель" });
                summary.events.skipped += 1;
                continue;
            }

            const teacherId = await this.findOrCreateTeacherByScheduleName(teacherName, teacherPassHash, summary);
            const groupId = await this.findOrCreateScheduleGroup(groupName, course, summary);
            const weekOffset = week.includes("чет") && !week.includes("нечет") ? 7 : 0;
            const startAt = new Date(baseMonday);
            startAt.setDate(baseMonday.getDate() + weekOffset + dayOffset);
            startAt.setHours(time.start.hours, time.start.minutes, 0, 0);

            const endAt = new Date(startAt);
            endAt.setHours(time.end.hours, time.end.minutes, 0, 0);

            const existing = await prisma.events.findFirst({
                where: {
                    teacherId,
                    groupId,
                    discipline: subject,
                    lessonType,
                    startAt,
                },
                select: { id: true },
            });

            if (existing) {
                summary.events.skipped += 1;
                continue;
            }

            await prisma.events.create({
                data: {
                    teacherId,
                    groupId,
                    title: `${subject}: ${lessonType}`,
                    description: `Первоначальное расписание, ${week} неделя`,
                    discipline: subject,
                    lessonType,
                    startAt,
                    endAt,
                    format: events_format.OFFLINE,
                    location: null,
                    link: null,
                    isOfficial: true,
                    status: events_status.scheduled,
                },
            });

            summary.events.created += 1;
        }
    }

    private async findOrCreateTeacherByScheduleName(name: string, passHash: string, summary: ImportSummary) {
        const surname = name.split(/\s+/)[0]?.trim();
        const initials = name.match(/([А-ЯЁA-Z])\.\s*([А-ЯЁA-Z])?\./i);
        const users = await prisma.users.findMany({
            where: {
                role: users_role.teacher,
                ...(surname ? { name: { contains: surname } } : {}),
            },
            select: { id: true, name: true },
        });
        const matched = users.find((user) => {
            if (!initials) {
                return true;
            }

            const parts = user.name.split(/\s+/).filter(Boolean);
            return (
                parts[1]?.startsWith(initials[1] ?? "") &&
                (!initials[2] || parts[2]?.startsWith(initials[2]))
            );
        }) ?? users[0];

        if (matched) {
            return matched.id;
        }

        const emailSlug = createHash("sha1").update(name).digest("hex").slice(0, 10);
        const teacher = await prisma.users.create({
            data: {
                email: `teacher-${emailSlug}@schedule.local`,
                name,
                role: users_role.teacher,
                passHash,
            },
            select: { id: true },
        });

        summary.users.created += 1;
        return teacher.id;
    }

    private async findOrCreateScheduleGroup(name: string, course: string, summary: ImportSummary) {
        const existing = await prisma.study_groups.findFirst({
            where: { name },
            select: { id: true },
        });

        if (existing) {
            return existing.id;
        }

        const group = await prisma.study_groups.create({
            data: {
                name,
                description: course ? `${course}, группа из расписания` : "Группа из расписания",
            },
            select: { id: true },
        });

        summary.groups.created += 1;
        return group.id;
    }

    private async importPollExample(
        pollRows: SheetRow[],
        votesRows: SheetRow[],
        teacherUserIdByExternalTeacherId: Map<string, number>,
        groupIdByExternalId: Map<string, number>,
        studentUserIdByExternalStudentId: Map<string, number>,
        summary: ImportSummary,
    ) {
        const pollRow = pollRows.find((row) => toText(row.poll_id).startsWith("POLL"));

        if (!pollRow) {
            return;
        }

        const teacherId = teacherUserIdByExternalTeacherId.get(toText(pollRow.teacher_id));
        const targetGroupIds = toText(pollRow.target_group_ids)
            .split(",")
            .map((item) => groupIdByExternalId.get(item.trim()))
            .filter((id): id is number => Boolean(id));
        const deadlineAt = toDateTime(pollRow.deadline, "23:59", 23);

        if (!teacherId || targetGroupIds.length === 0 || !deadlineAt) {
            summary.errors.push({ sheet: "Пример опроса", row: 2, message: "Не удалось сопоставить преподавателя, группы или дедлайн опроса" });
            return;
        }

        const existingPoll = await prisma.polls.findFirst({
            where: {
                teacherId,
                title: toText(pollRow.title),
                discipline: toText(pollRow.subject_name) || null,
            },
            select: { id: true },
        });

        if (existingPoll) {
            summary.polls.skipped += 1;
            return;
        }

        const optionRows = pollRows.filter((row) => toText(row.poll_id).startsWith("OPT"));
        const participants = await prisma.users.findMany({
            where: {
                role: users_role.student,
                groupId: { in: targetGroupIds },
            },
            select: { id: true },
        });

        const optionIdByExternalId = new Map<string, number>();
        const poll = await prisma.$transaction(async (tx) => {
            const createdPoll = await tx.polls.create({
                data: {
                    teacherId,
                    title: toText(pollRow.title),
                    description: "Опрос из импортированного набора данных",
                    discipline: toText(pollRow.subject_name) || null,
                    lessonType: "другое",
                    deadlineAt,
                    threshold: Number(pollRow.threshold_percent) || 60,
                    status: toText(pollRow.status) === "active" ? polls_status.active : polls_status.draft,
                },
                select: { id: true },
            });

            await tx.poll_target_groups.createMany({
                data: targetGroupIds.map((groupId) => ({
                    pollId: createdPoll.id,
                    groupId,
                })),
                skipDuplicates: true,
            });

            if (participants.length > 0) {
                await tx.poll_participants_snapshot.createMany({
                    data: participants.map((student) => ({
                        pollId: createdPoll.id,
                        studentId: student.id,
                    })),
                    skipDuplicates: true,
                });
            }

            for (const optionRow of optionRows) {
                const startAt = toDateTime(optionRow.subject_id, optionRow.subject_name);
                const duration = Number(optionRow.teacher_id) || 90;

                if (!startAt) {
                    continue;
                }

                const endAt = new Date(startAt);
                endAt.setMinutes(endAt.getMinutes() + duration);

                const option = await tx.poll_options.create({
                    data: {
                        pollId: createdPoll.id,
                        startAt,
                        endAt,
                        format: poll_options_format.OFFLINE,
                        location: toText(optionRow.target_group_ids) || null,
                    },
                    select: { id: true },
                });

                optionIdByExternalId.set(toText(optionRow.poll_id), option.id);
            }

            return createdPoll;
        });

        summary.polls.created += 1;

        const seenStudentVotes = new Set<string>();

        for (const [index, row] of votesRows.entries()) {
            const studentId = studentUserIdByExternalStudentId.get(toText(row.student_id));
            const optionId = optionIdByExternalId.get(toText(row.option_id));

            if (!studentId || !optionId) {
                summary.votes.skipped += 1;
                continue;
            }

            const voteKey = `${studentId}:${optionId}`;

            if (seenStudentVotes.has(voteKey)) {
                summary.votes.skipped += 1;
                summary.errors.push({
                    sheet: "Голоса",
                    row: index + 2,
                    message: "Повторный голос того же студента за тот же вариант пропущен",
                });
                continue;
            }

            seenStudentVotes.add(voteKey);

            try {
                await prisma.votes.create({
                    data: {
                        pollId: poll.id,
                        optionId,
                        studentId,
                    },
                });
                summary.votes.created += 1;
            } catch {
                summary.votes.skipped += 1;
            }
        }
    }
}
