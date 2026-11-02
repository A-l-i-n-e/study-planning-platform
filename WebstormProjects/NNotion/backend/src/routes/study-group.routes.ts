import { Router } from "express";
import { StudyGroupController } from "../controllers/study-group.controllers";
import { GroupStudentController } from "../controllers/group_students.controller";
import { authRequired, roleRequired } from "../midllewares/user.middleware";
import { users_role } from "../../generated/prisma/enums";

export const studyGroupRouter = Router();

// группы
studyGroupRouter.post(
    "/groups",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    StudyGroupController.create
);

studyGroupRouter.get(
    "/groups",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    StudyGroupController.list
);

studyGroupRouter.get(
    "/groups/teaching-disciplines",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    StudyGroupController.listTeachingDisciplines
);

studyGroupRouter.get(
    "/groups/by-discipline",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    StudyGroupController.listTeachingGroupsByDiscipline
);

studyGroupRouter.get(
    "/groups/:id",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    StudyGroupController.getById
);

studyGroupRouter.patch(
    "/groups/:id",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    StudyGroupController.update
);

studyGroupRouter.delete(
    "/groups/:id",
    authRequired,
    roleRequired(users_role.admin),
    StudyGroupController.remove
);

// студенты в группе
studyGroupRouter.post(
    "/groups/:groupId/students",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    GroupStudentController.addStudent
);

studyGroupRouter.post(
    "/groups/:groupId/students/import",
    authRequired,
    roleRequired(users_role.admin),
    GroupStudentController.importStudents
);

studyGroupRouter.get(
    "/groups/:groupId/students",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    GroupStudentController.getStudentsByGroup
);

studyGroupRouter.delete(
    "/groups/:groupId/students/:studentId",
    authRequired,
    roleRequired(users_role.teacher, users_role.admin),
    GroupStudentController.removeStudent
);
