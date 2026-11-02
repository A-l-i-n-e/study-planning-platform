CREATE TABLE `poll_results` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `poll_id` INTEGER NOT NULL,
  `selected_option_id` INTEGER NOT NULL,
  `teacher_id` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `poll_results_poll_id_key`(`poll_id`),
  INDEX `poll_results_selected_option_id_idx`(`selected_option_id`),
  INDEX `poll_results_teacher_id_idx`(`teacher_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `poll_results`
  ADD CONSTRAINT `poll_results_poll_id_fkey`
  FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `poll_results`
  ADD CONSTRAINT `poll_results_selected_option_id_fkey`
  FOREIGN KEY (`selected_option_id`) REFERENCES `poll_options`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `poll_results`
  ADD CONSTRAINT `poll_results_teacher_id_fkey`
  FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `poll_results` (`poll_id`, `selected_option_id`, `teacher_id`, `created_at`)
SELECT `polls`.`id`, `polls`.`finalOptionId`, `polls`.`teacherId`, COALESCE(`polls`.`approvedAt`, CURRENT_TIMESTAMP(3))
FROM `polls`
INNER JOIN `poll_options`
  ON `poll_options`.`id` = `polls`.`finalOptionId`
WHERE `polls`.`finalOptionId` IS NOT NULL;
