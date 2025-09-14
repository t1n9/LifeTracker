-- 删除用户表中的目标相关字段
ALTER TABLE "public"."users" DROP COLUMN IF EXISTS "target_name";
ALTER TABLE "public"."users" DROP COLUMN IF EXISTS "target_date";
ALTER TABLE "public"."users" DROP COLUMN IF EXISTS "exam_date";
