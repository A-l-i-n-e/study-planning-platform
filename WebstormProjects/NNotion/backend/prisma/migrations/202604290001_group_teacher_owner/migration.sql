-- Add owner for teacher-visible groups.
ALTER TABLE `study_groups` ADD COLUMN `teacherId` INTEGER NULL;

CREATE INDEX `study_groups_teacherId_idx` ON `study_groups`(`teacherId`);

ALTER TABLE `study_groups`
  ADD CONSTRAINT `study_groups_teacherId_fkey`
  FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
