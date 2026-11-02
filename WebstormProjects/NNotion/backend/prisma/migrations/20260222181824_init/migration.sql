-- CreateTable
CREATE TABLE `courses` (
    `id` INTEGER NOT NULL,
    `title` VARCHAR(45) NOT NULL,
    `teachers_id` VARCHAR(45) NOT NULL,

    UNIQUE INDEX `id_UNIQUE`(`id`),
    UNIQUE INDEX `title_UNIQUE`(`title`),
    PRIMARY KEY (`id`, `teachers_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login` (
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(45) NOT NULL,
    `password` VARCHAR(45) NOT NULL,
    `role` VARCHAR(45) NOT NULL,

    UNIQUE INDEX `email_UNIQUE`(`email`),
    UNIQUE INDEX `password_UNIQUE`(`password`),
    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `id` INTEGER NOT NULL,
    `course_id` VARCHAR(45) NOT NULL,
    `title` VARCHAR(45) NOT NULL,
    `start_time` VARCHAR(45) NOT NULL,
    `end_time` VARCHAR(45) NOT NULL,
    `location` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`id`, `course_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_participants` (
    `session_id` INTEGER NOT NULL,
    `student_id` VARCHAR(45) NOT NULL,
    `status` VARCHAR(45) NOT NULL,
    `registered_at` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student` (
    `id` INTEGER NOT NULL,
    `user_id` VARCHAR(45) NOT NULL,
    `group` VARCHAR(45) NOT NULL,
    `course` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher` (
    `id` INTEGER NOT NULL,
    `user_id` VARCHAR(45) NOT NULL,
    `department` VARCHAR(45) NOT NULL,
    `position` VARCHAR(45) NOT NULL,
    `degree` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
