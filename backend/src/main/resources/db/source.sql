-- ============================================================
-- OA_PER 开发环境假数据脚本（MySQL: oa_per）
-- 表：dept（部门）/ job（职位）/ emp（员工）
-- 前置：已执行 src/main/resources/db/schema.sql 建库建表
-- 特性：使用固定 ID 段（dept 1-8 / job 1-12 / emp 1-20），可反复执行；
--       每次执行先清掉本脚本上次插入的数据，再重新插入
-- 测试账号：所有员工密码统一为 password（BCrypt 加密存储）
--   - 管理员  ：zhangwei@oa.com
--   - 正常员工：lina@oa.com、wangqiang@oa.com 等
--   - 特殊状态：fengzhe@oa.com(待完善) / heli@oa.com(禁用) / jiangbin@oa.com(逻辑删除)
-- ============================================================

USE `oa_per`;
SET NAMES utf8mb4;

-- 临时关闭外键校验，避免清理顺序受影响（脚本内引用自洽，执行完自动恢复）
SET FOREIGN_KEY_CHECKS = 0;



-- ---------- 1. 部门 ----------
INSERT INTO `dept` (`id`, `dept_name`, `description`) VALUES
                                                          (1, '研发部', '负责产品技术研发、架构设计与运维保障'),
                                                          (2, '产品部', '负责产品规划、需求分析与用户体验设计'),
                                                          (3, '人事部', '负责招聘、培训、考勤与员工关系管理'),
                                                          (4, '财务部', '负责财务核算、报销审批与预算管理'),
                                                          (5, '市场部', '负责市场推广、品牌宣传与商务合作'),
                                                          (6, '行政部', '负责行政后勤、办公物资与固定资产管理');

-- ---------- 2. 职位 ----------
INSERT INTO `job` (`id`, `job_name`, `sort`) VALUES
                                                 (1,  '总经理',         1),
                                                 (2,  '技术总监',       2),
                                                 (3,  '产品经理',       3),
                                                 (4,  'Java开发工程师', 4),
                                                 (5,  '前端开发工程师', 5),
                                                 (6,  '测试工程师',     6),
                                                 (7,  '人事专员',       7),
                                                 (8,  '会计',           8),
                                                 (9,  '市场专员',       9),
                                                 (10, '行政专员',       10);

-- BCrypt("password")；如需换成其它明文密码，用 BCryptPasswordEncoder.encode 生成后替换
SET @pwd = '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG';


-- ---------- 3. 员工：管理员（role_type=1） ----------
INSERT INTO `emp` (`id`, `emp_no`, `name`, `gender`, `phone`, `email`, `password`, `dept_id`, `job_id`, `hire_date`, `role_type`, `account_status`) VALUES
    (1, 'A1001', '张伟', 1, '13800000001', 'zhangwei@oa.com', @pwd, 1, 1, '2020-01-01', 1, 1);


-- ---------- 4. 员工：普通员工（account_status=1 正常） ----------
INSERT INTO `emp` (`id`, `emp_no`, `name`, `gender`, `phone`, `email`, `password`, `dept_id`, `job_id`, `hire_date`, `role_type`, `account_status`) VALUES
                                                                                                                                                        (2,  'A1002', '李娜', 0, '13800000002', 'lina@oa.com',        @pwd, 2, 3,  '2021-03-15', 0, 1),
                                                                                                                                                        (3,  'A1003', '王强', 1, '13800000003', 'wangqiang@oa.com',   @pwd, 1, 4,  '2022-07-01', 0, 1),
                                                                                                                                                        (4,  'A1004', '刘洋', 1, '13800000004', 'liuyang@oa.com',     @pwd, 1, 5,  '2022-09-13', 0, 1),
                                                                                                                                                        (5,  'A1005', '陈静', 0, '13800000005', 'chenjing@oa.com',    @pwd, 1, 6,  '2023-02-27', 0, 1),
                                                                                                                                                        (6,  'A1006', '赵敏', 0, '13800000006', 'zhaomin@oa.com',     @pwd, 3, 7,  '2023-05-08', 0, 1),
                                                                                                                                                        (7,  'A1007', '孙磊', 1, '13800000007', 'sunlei@oa.com',      @pwd, 4, 8,  '2020-11-16', 0, 1),
                                                                                                                                                        (8,  'A1008', '周婷', 0, '13800000008', 'zhouting@oa.com',    @pwd, 5, 9,  '2024-01-22', 0, 1),
                                                                                                                                                        (9,  'A1009', '吴昊', 1, '13800000009', 'wuhao@oa.com',       @pwd, 6, 10, '2024-04-10', 0, 1),
                                                                                                                                                        (10, 'A1010', '郑爽', 0, '13800000010', 'zhengshuang@oa.com', @pwd, 2, 3,  '2023-08-21', 0, 1);

-- ---------- 5. 员工：特殊状态（待完善 / 禁用 / 逻辑删除） ----------
-- 冯哲：account_status=2 待完善（测试 complete-profile 流程）
-- 何丽：account_status=0 禁用（测试登录被拒）
-- 蒋斌：is_deleted=1 已删除（测试列表过滤）
INSERT INTO `emp` (`id`, `emp_no`, `name`, `gender`, `phone`, `email`, `password`, `dept_id`, `job_id`, `hire_date`, `role_type`, `account_status`, `is_deleted`) VALUES
                                                                                                                                                                      (11, 'A1011', '冯哲', 1, '13800000011', 'fengzhe@oa.com',  @pwd, 1, 4, '2025-06-30', 0, 2, 0),
                                                                                                                                                                      (12, 'A1012', '何丽', 0, '13800000012', 'heli@oa.com',     @pwd, 1, 6, '2025-09-01', 0, 0, 0),
                                                                                                                                                                      (13, 'A1013', '蒋斌', 1, '13800000013', 'jiangbin@oa.com', @pwd, 1, 4, '2021-10-12', 0, 1, 1);

SET FOREIGN_KEY_CHECKS = 1;

-- ---------- 6. 验证结果 ----------
-- 各部门人数
SELECT d.id, d.dept_name, COUNT(e.id) AS emp_count
FROM `dept` d
         LEFT JOIN `emp` e ON e.dept_id = d.id AND e.is_deleted = 0
GROUP BY d.id, d.dept_name
ORDER BY d.id;

-- 账号一览（登录测试用）
SELECT emp_no, name, email, account_status, role_type, is_deleted
FROM `emp`
WHERE id BETWEEN 1 AND 20
ORDER BY id;