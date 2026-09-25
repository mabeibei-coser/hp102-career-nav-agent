# HP102 → admin-hub 接入说明

## 数据库

- 路径：由 `HP102_DB_PATH` 环境变量指定（默认 `./data/hp102.db`）
- admin-hub 使用 `ATTACH DATABASE ? AS hp102` 别名挂载
- 兼容列与 A300 `navSelect` 一致：
  - `id`, `created_at`, `target_position`, `has_resume`, `resume_filename`
  - `user_identity`, `uuid`, `duration_ms`, `sections_status`, `ip`
  - `form_data_json`, `report_json`
- `json_extract(form_data_json, '$.education')` → `bachelor` 等
- `json_extract(form_data_json, '$.workYears')` → `lt1` 等
- `json_extract(form_data_json, '$.birthDate')` → `2003-05`
- `json_extract(form_data_json, '$.phone')` → 手机号
- `json_extract(report_json, '$.employmentIndex')` → 数字

## 接入步骤（另开任务）

1. admin-hub `.env.local` 加 `HP102_DB_PATH=<绝对路径>`
2. `app/api/admin/reports/route.ts` 加 ATTACH 和对应 SELECT
3. 侧边栏加"职业导航"入口
4. 用 `admin-hub-add-project` skill 执行

## 注意

- HP102 数据库为 WAL 模式，admin-hub 只读挂载
- reports 表的 `user_phone` 列在登录后才有值
