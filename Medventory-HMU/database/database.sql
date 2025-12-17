-- ============================================
-- MEDVENTORY_HMU - RESET & SEED (PostgreSQL)
-- Safe to rerun: drops schema and recreates all
-- ============================================

BEGIN;

-- 0) RESET SCHEMA
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SET search_path TO public;

-- 1) MASTER DATA
CREATE TABLE departments (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE sub_departments (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    department_id    INT REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE (name, department_id)
);

CREATE TABLE units (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- 2) USERS
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(100) UNIQUE NOT NULL,
    password        VARCHAR(100) NOT NULL,
    date_of_birth   DATE,
    department_id   INT REFERENCES departments(id),

    -- role_check: giá trị số để phân quyền
    role_check      INT CHECK (role_check IN (0,1,2,3)) NOT NULL DEFAULT 3,
    -- 0 = Ban Giám Hiệu
    -- 1 = Lãnh đạo
    -- 2 = Thủ kho
    -- 3 = Cán bộ

    -- role: chỉ để lưu tên chức vụ thực tế
    role            VARCHAR(100),

    -- status: 0 = pending (chờ duyệt), 1 = approved (đã duyệt)
    status          INT CHECK (status IN (0,1)) NOT NULL DEFAULT 0
);

-- 3) MATERIALS CATALOG
CREATE TABLE materials (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    spec            VARCHAR(255) NOT NULL,
    unit_id         INT REFERENCES units(id) NOT NULL,
    code            VARCHAR(100) NOT NULL,
    manufacturer    VARCHAR(255) NOT NULL,
    category        CHAR(1) CHECK (category IN ('A','B','C','D')) NOT NULL,
    UNIQUE (code),
    UNIQUE (name, spec, manufacturer)
);

-- 4) ISSUE REQUEST (Đơn vị xin lĩnh)
CREATE TABLE issue_req_header (
    id                  SERIAL PRIMARY KEY,
    created_by          INT REFERENCES users(id) ON DELETE SET NULL,
    sub_department_id   INT REFERENCES sub_departments(id),
    department_id       INT REFERENCES departments(id),
    requested_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 0 = pending, 1 = approved, 2 = rejected
    status              INT CHECK (status IN (0,1,2)) NOT NULL DEFAULT 0,

    approval_by         INT REFERENCES users(id) ON DELETE SET NULL,
    approval_at         TIMESTAMP,
    approval_note       TEXT,
    note                TEXT
);

CREATE TABLE issue_req_detail (
    id                  SERIAL PRIMARY KEY,
    header_id           INT REFERENCES issue_req_header(id) ON DELETE CASCADE,
    material_id         INT REFERENCES materials(id),

    -- fallback nếu đồ chưa có trong danh mục
    material_name       VARCHAR(255),
    spec                VARCHAR(255),
    unit_id             INT REFERENCES units(id),

    qty_requested       NUMERIC(18,3) NOT NULL CHECK (qty_requested > 0),

    proposed_code         VARCHAR(100),
    proposed_manufacturer VARCHAR(255),
    
    -- THÊM COLUMN MỚI: lưu category cho vật tư mới
    material_category   CHAR(1) CHECK (material_category IN ('A','B','C','D')),

    CHECK (
        (material_id IS NOT NULL)
        OR (material_name IS NOT NULL AND unit_id IS NOT NULL)
    )
);

-- 5) SUPPLEMENT FORECAST (Dự trù bổ sung)
CREATE TABLE supp_forecast_header (
    id              SERIAL PRIMARY KEY,
    created_by      INT REFERENCES users(id) ON DELETE SET NULL,
    created_at      DATE DEFAULT CURRENT_DATE,
    academic_year   VARCHAR(20),
    department_id   INT REFERENCES departments(id),

    -- 0 = pending, 1 = approved, 2 = rejected
    status          INT CHECK (status IN (0,1,2)) NOT NULL DEFAULT 0,

    approval_by     INT REFERENCES users(id) ON DELETE SET NULL,
    approval_at     TIMESTAMP,
    approval_note   TEXT
);

CREATE TABLE supp_forecast_detail (
    id                  SERIAL PRIMARY KEY,
    header_id           INT REFERENCES supp_forecast_header(id) ON DELETE CASCADE,
    material_id         INT REFERENCES materials(id),

    current_stock       NUMERIC(18,3) DEFAULT 0,
    prev_year_qty       NUMERIC(18,3) DEFAULT 0,
    this_year_qty       NUMERIC(18,3) NOT NULL,
    proposed_code         VARCHAR(100),
    proposed_manufacturer VARCHAR(255),
    justification       TEXT
);

-- 6) CATALOG SUMMARY (tổng hợp nhu cầu theo đơn vị)
CREATE TABLE catalog_summary_header (
    id               SERIAL PRIMARY KEY,
    supp_forecast_id INT UNIQUE NOT NULL REFERENCES supp_forecast_header(id) ON DELETE CASCADE
);

CREATE TABLE catalog_summary_detail (
    id                  SERIAL PRIMARY KEY,
    header_id           INT REFERENCES catalog_summary_header(id) ON DELETE CASCADE,
    material_id         INT REFERENCES materials(id),
    sub_department_id   INT REFERENCES sub_departments(id),
    display_name        VARCHAR(255),
    display_spec        VARCHAR(255),
    unit_id             INT REFERENCES units(id),
    qty                 NUMERIC(18,3) NOT NULL CHECK (qty > 0),
    category            CHAR(1) CHECK (category IN ('A','B','C','D')) NOT NULL
);

-- 7) RECEIPT (Phiếu nhập kho)
CREATE TABLE receipt_header (
    id              SERIAL PRIMARY KEY,
    created_by      INT REFERENCES users(id),
    received_from   VARCHAR(255),
    reason          TEXT,
    receipt_date    DATE DEFAULT CURRENT_DATE,
    total_amount    NUMERIC(18,2)
);

CREATE TABLE receipt_detail (
    id              SERIAL PRIMARY KEY,
    header_id       INT REFERENCES receipt_header(id) ON DELETE CASCADE,
    material_id     INT REFERENCES materials(id),

    name            VARCHAR(255),
    spec            VARCHAR(255),
    code            VARCHAR(100),

    unit_id         INT REFERENCES units(id),
    price           NUMERIC(18,2),
    qty_doc         NUMERIC(18,3),
    qty_actual      NUMERIC(18,3),

    lot_number      VARCHAR(100),
    mfg_date        DATE,
    exp_date        DATE,

    total           NUMERIC(18,2)
);

-- 8) ISSUE (Phiếu xuất kho)
CREATE TABLE issue_header (
    id               SERIAL PRIMARY KEY,
    created_by       INT REFERENCES users(id),
    receiver_name    VARCHAR(255),
    department_id    INT REFERENCES departments(id),
    issue_date       DATE DEFAULT CURRENT_DATE,
    total_amount     NUMERIC(18,2),
    
    -- 📢 BỔ SUNG: Cờ báo đây là Phiếu Thuốc Đặc Biệt (Ví dụ: Thuốc Gây Nghiện)
    is_controlled_substance BOOLEAN DEFAULT FALSE
);

CREATE TABLE issue_detail (
    id               SERIAL PRIMARY KEY,
    header_id        INT REFERENCES issue_header(id) ON DELETE CASCADE,
    material_id      INT REFERENCES materials(id),

    name             VARCHAR(255),
    spec             VARCHAR(255),
    code             VARCHAR(100),

    unit_id          INT REFERENCES units(id),
    unit_price       NUMERIC(18,2),

    qty_requested    NUMERIC(18,3),
    qty_issued       NUMERIC(18,3),
    
    -- 📢 BỔ SUNG 2 TRƯỜNG MỚI THEO YÊU CẦU
    manufacturer     VARCHAR(255),
    country          VARCHAR(100),

    total            NUMERIC(18,2)
);

-- 9) INVENTORY CARD (Thẻ kho theo lô)
CREATE TABLE inventory_card (
    id                  SERIAL PRIMARY KEY,
    material_id         INT REFERENCES materials(id),
    unit_id             INT REFERENCES units(id),
    warehouse_name      VARCHAR(255),
    record_date         DATE DEFAULT CURRENT_DATE,
    opening_stock       NUMERIC(18,3) DEFAULT 0,
    qty_in              NUMERIC(18,3) DEFAULT 0,
    qty_out             NUMERIC(18,3) DEFAULT 0,
    closing_stock       NUMERIC(18,3)
        GENERATED ALWAYS AS (opening_stock + qty_in - qty_out) STORED,
    supplier            VARCHAR(255),
    lot_number          VARCHAR(100),
    mfg_date            DATE,
    exp_date            DATE,
    sub_department_id   INT REFERENCES sub_departments(id)
);

-- 10) Thông báo hệ thống
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,

    -- Người nhận thông báo
    user_id INT REFERENCES users(id) ON DELETE CASCADE,

    -- Loại chứng từ liên quan
    entity_type INT NOT NULL CHECK (entity_type IN (0,1)),
    -- 0 = issue_req (phiếu xin lĩnh)
    -- 1 = supp_forecast (phiếu dự trù bổ sung)

    entity_id INT NOT NULL,

    -- Loại sự kiện (đã đổi sang số)
    event_type INT NOT NULL CHECK (event_type IN (0,1,2,3)),
    -- 0 = pending (chờ phê duyệt)
    -- 1 = approved (đã duyệt)
    -- 2 = rejected (từ chối)
    -- 3 = scheduled (hẹn lịch / thông báo thời gian)

    title VARCHAR(255),
    content TEXT,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- INDEXES
CREATE INDEX idx_subdep_dept                 ON sub_departments(department_id);
CREATE INDEX idx_issue_req_header_dept         ON issue_req_header(department_id);
CREATE INDEX idx_issue_req_header_status       ON issue_req_header(status);
CREATE INDEX idx_supp_forecast_header_dept     ON supp_forecast_header(department_id);
CREATE INDEX idx_supp_forecast_header_status   ON supp_forecast_header(status);
CREATE INDEX idx_catalog_summary_detail_subdep ON catalog_summary_detail(sub_department_id);
CREATE INDEX idx_inventory_material            ON inventory_card(material_id);
CREATE INDEX idx_materials_code                ON materials(code);

-- ============================================
-- SEED DATA
-- (Dữ liệu seed không thay đổi)
-- ============================================

-- Departments
INSERT INTO departments(name) VALUES
('Quản trị vật tư'),
('Khoa xét nghiệm'),
('Khoa phục hồi chức năng'),
('Khoa gây mê hồi sức và chống đau'),
('Khoa cấp cứu'),
('Khoa mắt'),
('Khoa ngoại tim mạch và lồng ngực'),
('Khoa ngoại tiết niệu'),
('Khoa dược'),
('Khoa hồi sức tích cực'),
('Khoa khám chữa bệnh theo yêu cầu'),
('Khoa giải phẫu bệnh'),
('Khoa nội thần kinh'),
('Khoa vi sinh - ký sinh trùng'),
('Khoa nội tổng hợp'),
('Khoa dinh dưỡng và tiết chế'),
('Khoa phẫu thuật tạo hình thẩm mỹ'),
('Khoa hô hấp'),
('Khoa kiểm soát nhiễm khuẩn'),
('Khoa thăm dò chức năng'),
('Khoa phụ sản'),
('Khoa nam học và y học giới tính'),
('Khoa ngoại tổng hợp'),
('Khoa nhi'),
('Khoa ngoại thần kinh - cột sống'),
('Khoa dị ứng - miễn dịch lâm sàng'),
('Khoa nội tiết'),
('Khoa huyết học và truyền máu'),
('Khoa y học cổ truyền'),
('Khoa răng hàm mặt'),
('Khoa chấn thương chỉnh hình và y học thể thao'),
('Khoa khám bệnh'),
('Khoa nội thận - tiết niệu'),
('Khoa bệnh nhiệt đới và can thiệp giảm hại');

-- Sub-departments
INSERT INTO sub_departments(name, department_id) VALUES
('Dược lý',  (SELECT id FROM departments WHERE name='Khoa dược')),
('Hóa sinh', (SELECT id FROM departments WHERE name='Khoa xét nghiệm')),
('BHPT',     (SELECT id FROM departments WHERE name='Khoa xét nghiệm')),
('Vi sinh',  (SELECT id FROM departments WHERE name='Khoa vi sinh - ký sinh trùng')),
('Kho chính', (SELECT id FROM departments WHERE name='Quản trị vật tư'));

-- Units
INSERT INTO units(name) VALUES
('chai'),('lọ'),('hộp'),('cái'),('ml'),('g'),('viên'),('kg'),('bộ');

-- ============================================
-- USERS 
-- ============================================

-- LÃNH ĐẠO & THỦ KHO: Thuộc Quản trị vật tư
INSERT INTO users(full_name, email, password, department_id, role_check, role, status) VALUES
('Trưởng phòng QTVT', 'lanhdao@gmail.com', '12345', (SELECT id FROM departments WHERE name='Quản trị vật tư'), 1, 'Trưởng phòng Quản trị vật tư', 0),
('Phó phòng QTVT', 'pholanhdao@gmail.com', '12345', (SELECT id FROM departments WHERE name='Quản trị vật tư'), 1, 'Phó phòng Quản trị vật tư', 1),
('Thủ Kho Chính', 'thukho@gmail.com', '12345', (SELECT id FROM departments WHERE name='Quản trị vật tư'), 2, 'Thủ kho chính', 0),
('Thủ Kho Phụ', 'thukho2@gmail.com', '12345', (SELECT id FROM departments WHERE name='Quản trị vật tư'), 2, 'Thủ kho phụ', 1);

-- CÁN BỘ: Thuộc các khoa khác (KHÔNG thuộc Quản trị vật tư)
INSERT INTO users(full_name, email, password, department_id, role_check, role, status) VALUES
('CB Bộ môn BHPT', 'canbo.bhpt@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa xét nghiệm'), 3, 'Cán bộ Bộ môn BHPT', 0),
('CB Hóa sinh', 'canbo.hoasinh@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa xét nghiệm'), 3, 'Cán bộ Hóa sinh', 1),
('CB Vi sinh', 'canbo.visinh@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa vi sinh - ký sinh trùng'), 3, 'Cán bộ Vi sinh', 0),
('CB Dược lý', 'canbo.duocly@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa dược'), 3, 'Cán bộ Dược lý', 1),
('CB Khám bệnh', 'canbo.khambenh@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa khám bệnh'), 3, 'Cán bộ Khám bệnh', 1),
('CB Cấp cứu', 'canbo.capcuu@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa cấp cứu'), 3, 'Cán bộ Cấp cứu', 0);

-- BAN GIÁM HIỆU: Không thuộc department nào
INSERT INTO users(full_name, email, password, department_id, role_check, role, status) VALUES
('GS. TS. BS. Nguyễn Hữu Tú', 'hieutruong@gmail.com', '12345', NULL, 0, 'Hiệu trưởng', 1),
('PGS. TS. BS. Kim Bảo Giang', 'phohieutruong1@gmail.com', '12345', NULL, 0, 'Phó Hiệu trưởng', 1),
('PGS. TS. BS. Hồ Thị Kim Thanh', 'phohieutruong2@gmail.com', '12345', NULL, 0, 'Phó Hiệu trưởng', 1),
('PGS. TS. BS. Lê Đình Tùng', 'phohieutruong3@gmail.com', '12345', NULL, 0, 'Phó Hiệu trưởng', 1),
('TS. Phạm Xuân Thắng', 'phohieutruong4@gmail.com', '12345', NULL, 0, 'Phó Hiệu trưởng', 1);

-- Materials
INSERT INTO materials(name, spec, unit_id, code, manufacturer, category) VALUES
('Ethanol 96%',       'Chai 500 ml',        (SELECT id FROM units WHERE name='chai'), 'ETH96-500',   'ABC Pharma',  'B'),
('Găng tay y tế',     'Hộp 100 chiếc',      (SELECT id FROM units WHERE name='hộp'),  'GLOVE-100',   'GloveCo',     'C'),
('Ống nghiệm thủy tinh','10 ml',             (SELECT id FROM units WHERE name='cái'),  'TUBE-10',     'LabGlass',    'D'),
('Paracetamol 500mg', 'Hộp 10 vỉ x 10 viên',(SELECT id FROM units WHERE name='hộp'),  'PARA500-100', 'MediPharm',   'A'),
('NaCl 0.9%',         'Chai 1000 ml',       (SELECT id FROM units WHERE name='chai'), 'NACL-1000',   'IVCo',        'B'),
('Khẩu trang y tế',   'Hộp 50 cái',         (SELECT id FROM units WHERE name='hộp'),  'MASK-50',     'ProtectMed',  'C'),
('Glucoza 5%',        'Chai 500 ml',        (SELECT id FROM units WHERE name='chai'), 'GLUC-500',    'IVCo',        'B'),
('Ống pipet 1ml',     'Bộ 100 cái',         (SELECT id FROM units WHERE name='bộ'),   'PIP1-100',    'LabMate',     'D'),
('Bông y tế vô trùng', 'Hộp 500g', (SELECT id FROM units WHERE name='hộp'), 'COTTON-500', 'MediCotton', 'C'),
('Băng gạc cá nhân', 'Hộp 100 cái', (SELECT id FROM units WHERE name='hộp'), 'BANDAGE-100', 'FirstAid Co', 'C'),
('Cồn 70 độ', 'Chai 500 ml', (SELECT id FROM units WHERE name='chai'), 'ALCOHOL-70', 'ABC Pharma', 'B'),
('Kim tiêm vô trùng', 'Hộp 100 cái', (SELECT id FROM units WHERE name='hộp'), 'SYRINGE-100', 'MediNeedle', 'A'),
('Gạc vô trùng', 'Hộp 50 miếng', (SELECT id FROM units WHERE name='hộp'), 'GAUZE-50', 'MediGauze', 'C'),
('Bơm kim tiêm 5ml', 'Hộp 50 cái', (SELECT id FROM units WHERE name='hộp'), 'SYRINGE-5ML', 'MediNeedle', 'A'),
('Hóa chất xét nghiệm', 'Lọ 100ml', (SELECT id FROM units WHERE name='lọ'), 'CHEM-TEST', 'LabChem', 'B'),
('Ống nghiệm plastic', 'Hộp 200 cái', (SELECT id FROM units WHERE name='hộp'), 'TUBE-PLASTIC', 'LabPlastic', 'D');

-- ============================================
-- DỮ LIỆU MẪU CHO ĐƠN DỰ TRÙ
-- ============================================

-- Supplement forecast headers
INSERT INTO supp_forecast_header (created_by, academic_year, department_id, status, approval_by, approval_at, approval_note) VALUES
((SELECT id FROM users WHERE email='thukho@gmail.com'), '2025-2026', (SELECT id FROM departments WHERE name='Khoa xét nghiệm'), 1, (SELECT id FROM users WHERE email='hieutruong@gmail.com'), NOW(), 'Đồng ý theo đề xuất'),
((SELECT id FROM users WHERE email='thukho@gmail.com'), '2025-2026', (SELECT id FROM departments WHERE name='Khoa xét nghiệm'), 0, NULL, NULL, NULL),
((SELECT id FROM users WHERE email='thukho2@gmail.com'), '2025-2026', (SELECT id FROM departments WHERE name='Khoa dược'), 1, (SELECT id FROM users WHERE email='phohieutruong1@gmail.com'), NOW(), 'Phê duyệt đủ số lượng'),
((SELECT id FROM users WHERE email='thukho@gmail.com'), '2025-2026', (SELECT id FROM departments WHERE name='Khoa cấp cứu'), 2, (SELECT id FROM users WHERE email='phohieutruong2@gmail.com'), NOW(), 'Cần điều chỉnh giảm số lượng'),
((SELECT id FROM users WHERE email='thukho2@gmail.com'), '2025-2026', (SELECT id FROM departments WHERE name='Khoa khám bệnh'), 0, NULL, NULL, NULL);

-- Supplement forecast details cho Khoa xét nghiệm (approved)
INSERT INTO supp_forecast_detail (header_id, material_id, current_stock, prev_year_qty, this_year_qty, proposed_code, proposed_manufacturer, justification) VALUES
(1, (SELECT id FROM materials WHERE code='ETH96-500'), 10, 50, 80, 'ETH96-500', 'ABC Pharma', 'Bổ sung phục vụ thực hành'),
(1, (SELECT id FROM materials WHERE code='GLOVE-100'), 20, 120, 150, 'GLOVE-100', 'GloveCo', 'Tăng nhu cầu thực hành'),
(1, (SELECT id FROM materials WHERE code='TUBE-10'), 50, 200, 250, 'TUBE-10', 'LabGlass', 'Thay thế hao hụt/vỡ');

-- Supplement forecast details cho Khoa xét nghiệm (pending)
INSERT INTO supp_forecast_detail (header_id, material_id, current_stock, prev_year_qty, this_year_qty, proposed_code, proposed_manufacturer, justification) VALUES
(2, (SELECT id FROM materials WHERE code='PIP1-100'), 30, 100, 150, 'PIP1-100', 'LabMate', 'Bổ sung dụng cụ thí nghiệm'),
(2, (SELECT id FROM materials WHERE code='CHEM-TEST'), 5, 20, 40, 'CHEM-TEST', 'LabChem', 'Tăng cường hóa chất xét nghiệm');

-- Supplement forecast details cho Khoa dược (approved)
INSERT INTO supp_forecast_detail (header_id, material_id, current_stock, prev_year_qty, this_year_qty, proposed_code, proposed_manufacturer, justification) VALUES
(3, (SELECT id FROM materials WHERE code='PARA500-100'), 15, 60, 90, 'PARA500-100', 'MediPharm', 'Dự trù cho nghiên cứu dược lý'),
(3, (SELECT id FROM materials WHERE code='NACL-1000'), 25, 80, 120, 'NACL-1000', 'IVCo', 'Dung dịch truyền nghiên cứu'),
(3, (SELECT id FROM materials WHERE code='SYRINGE-100'), 40, 150, 200, 'SYRINGE-100', 'MediNeedle', 'Kim tiêm thí nghiệm');

-- Supplement forecast details cho Khoa cấp cứu (rejected)
INSERT INTO supp_forecast_detail (header_id, material_id, current_stock, prev_year_qty, this_year_qty, proposed_code, proposed_manufacturer, justification) VALUES
(4, (SELECT id FROM materials WHERE code='ALCOHOL-70'), 5, 40, 60, 'ALCOHOL-70', 'ABC Pharma', 'Dự phòng cho trường hợp khẩn cấp'),
(4, (SELECT id FROM materials WHERE code='GLOVE-100'), 15, 80, 120, 'GLOVE-100', 'GloveCo', 'Tăng cường phòng hộ'),
(4, (SELECT id FROM materials WHERE code='MASK-50'), 20, 60, 100, 'MASK-50', 'ProtectMed', 'Khẩu trang y tế'),
(4, (SELECT id FROM materials WHERE code='BANDAGE-100'), 10, 30, 50, 'BANDAGE-100', 'FirstAid Co', 'Băng gạc sơ cứu');

-- Supplement forecast details cho Khoa khám bệnh (pending)
INSERT INTO supp_forecast_detail (header_id, material_id, current_stock, prev_year_qty, this_year_qty, proposed_code, proposed_manufacturer, justification) VALUES
(5, (SELECT id FROM materials WHERE code='COTTON-500'), 25, 80, 120, 'COTTON-500', 'MediCotton', 'Tăng cường vật tư khám bệnh'),
(5, (SELECT id FROM materials WHERE code='GAUZE-50'), 30, 100, 150, 'GAUZE-50', 'MediGauze', 'Gạc vô trùng khám bệnh'),
(5, (SELECT id FROM materials WHERE code='SYRINGE-5ML'), 20, 60, 90, 'SYRINGE-5ML', 'MediNeedle', 'Bơm kim tiêm khám bệnh'),
(5, (SELECT id FROM materials WHERE code='GLOVE-100'), 35, 120, 180, 'GLOVE-100', 'GloveCo', 'Găng tay khám bệnh');


-- ============================================
-- PHIẾU XIN LĨNH MẪU (CẬP NHẬT VỚI MATERIAL_CATEGORY)
-- ============================================

-- Phiếu 1: Đã phê duyệt
INSERT INTO issue_req_header(created_by, sub_department_id, department_id, requested_at, status, approval_by, approval_at, approval_note, note) VALUES
((SELECT id FROM users WHERE email='canbo.bhpt@gmail.com'), 
 (SELECT id FROM sub_departments WHERE name='BHPT'), 
 (SELECT id FROM departments WHERE name='Khoa xét nghiệm'), 
 NOW() - INTERVAL '3 days', 1, 
 (SELECT id FROM users WHERE email='lanhdao@gmail.com'), 
 NOW() - INTERVAL '2 days', 
 'Phê duyệt cấp phát đầy đủ', 
 'Xin lĩnh vật tư thí nghiệm cho sinh viên');

-- Phiếu 2: Chờ phê duyệt - CB Hóa sinh
INSERT INTO issue_req_header(created_by, sub_department_id, department_id, requested_at, status, note) VALUES
((SELECT id FROM users WHERE email='canbo.hoasinh@gmail.com'), 
 (SELECT id FROM sub_departments WHERE name='Hóa sinh'), 
 (SELECT id FROM departments WHERE name='Khoa xét nghiệm'), 
 NOW() - INTERVAL '2 days', 0, 
 'Xin lĩnh vật tư cho thí nghiệm Hóa sinh thực hành cho sinh viên năm 2');

-- Phiếu 3: Chờ phê duyệt - CB Vi sinh
INSERT INTO issue_req_header(created_by, sub_department_id, department_id, requested_at, status, note) VALUES
((SELECT id FROM users WHERE email='canbo.visinh@gmail.com'), 
 (SELECT id FROM sub_departments WHERE name='Vi sinh'), 
 (SELECT id FROM departments WHERE name='Khoa vi sinh - ký sinh trùng'), 
 NOW() - INTERVAL '1 day', 0, 
 'Xin lĩnh vật tư cho phòng thí nghiệm vi sinh');

-- Phiếu 4: Chờ phê duyệt - CB Khám bệnh
INSERT INTO issue_req_header(created_by, sub_department_id, department_id, requested_at, status, note) VALUES
((SELECT id FROM users WHERE email='canbo.khambenh@gmail.com'), 
 NULL, 
 (SELECT id FROM departments WHERE name='Khoa khám bệnh'), 
 NOW() - INTERVAL '12 hours', 0, 
 'Xin lĩnh vật tư cho công tác khám chữa bệnh định kỳ');

-- Phiếu 5: Chờ phê duyệt - CB Cấp cứu
INSERT INTO issue_req_header(created_by, sub_department_id, department_id, requested_at, status, note) VALUES
((SELECT id FROM users WHERE email='canbo.capcuu@gmail.com'), 
 NULL, 
 (SELECT id FROM departments WHERE name='Khoa cấp cứu'), 
 NOW() - INTERVAL '6 hours', 0, 
 'Xin lĩnh vật tư khẩn cấp cho khoa cấp cứu');

-- Phiếu 6: Đã từ chối
INSERT INTO issue_req_header(created_by, sub_department_id, department_id, requested_at, status, approval_by, approval_at, approval_note, note) VALUES
((SELECT id FROM users WHERE email='canbo.duocly@gmail.com'), 
 (SELECT id FROM sub_departments WHERE name='Dược lý'), 
 (SELECT id FROM departments WHERE name='Khoa dược'), 
 NOW() - INTERVAL '5 days', 2, 
 (SELECT id FROM users WHERE email='lanhdao@gmail.com'), 
 NOW() - INTERVAL '4 days', 
 'Số lượng yêu cầu vượt quá định mức cho phép', 
 'Xin lĩnh vật tư cho nghiên cứu dược lý - số lượng lớn');

-- THÊM PHIẾU 7: Có vật tư mới (pending)
INSERT INTO issue_req_header(created_by, sub_department_id, department_id, requested_at, status, note) VALUES
((SELECT id FROM users WHERE email='canbo.hoasinh@gmail.com'), 
 (SELECT id FROM sub_departments WHERE name='Hóa sinh'), 
 (SELECT id FROM departments WHERE name='Khoa xét nghiệm'), 
 NOW() - INTERVAL '1 day', 0, 
 'Xin lĩnh vật tư mới cho nghiên cứu đặc biệt');

-- ============================================
-- CHI TIẾT PHIẾU XIN LĨNH (CẬP NHẬT VỚI MATERIAL_CATEGORY)
-- ============================================

-- Chi tiết Phiếu 1 (approved) - Vật tư có sẵn
INSERT INTO issue_req_detail(header_id, material_id, qty_requested, material_category) VALUES
(1, (SELECT id FROM materials WHERE code='ETH96-500'), 15, 'B'),
(1, (SELECT id FROM materials WHERE code='GLOVE-100'), 10, 'C'),
(1, (SELECT id FROM materials WHERE code='MASK-50'), 5, 'C');

-- Chi tiết Phiếu 2 (pending) - Vật tư có sẵn
INSERT INTO issue_req_detail(header_id, material_id, qty_requested, material_category) VALUES
(2, (SELECT id FROM materials WHERE code='ETH96-500'), 15, 'B'),
(2, (SELECT id FROM materials WHERE code='GLOVE-100'), 20, 'C'),
(2, (SELECT id FROM materials WHERE code='TUBE-10'), 25, 'D'),
(2, (SELECT id FROM materials WHERE code='PIP1-100'), 8, 'D');

-- Chi tiết Phiếu 3 (pending) - Vật tư có sẵn
INSERT INTO issue_req_detail(header_id, material_id, qty_requested, material_category) VALUES
(3, (SELECT id FROM materials WHERE code='NACL-1000'), 12, 'B'),
(3, (SELECT id FROM materials WHERE code='MASK-50'), 15, 'C'),
(3, (SELECT id FROM materials WHERE code='GLUC-500'), 10, 'B'),
(3, (SELECT id FROM materials WHERE code='ALCOHOL-70'), 8, 'B');

-- Chi tiết Phiếu 4 (pending) - Vật tư có sẵn
INSERT INTO issue_req_detail(header_id, material_id, qty_requested, material_category) VALUES
(4, (SELECT id FROM materials WHERE code='GLOVE-100'), 30, 'C'),
(4, (SELECT id FROM materials WHERE code='MASK-50'), 25, 'C'),
(4, (SELECT id FROM materials WHERE code='COTTON-500'), 5, 'C'),
(4, (SELECT id FROM materials WHERE code='BANDAGE-100'), 4, 'C'),
(4, (SELECT id FROM materials WHERE code='GAUZE-50'), 6, 'C');

-- Chi tiết Phiếu 5 (pending) - Vật tư có sẵn
INSERT INTO issue_req_detail(header_id, material_id, qty_requested, material_category) VALUES
(5, (SELECT id FROM materials WHERE code='ALCOHOL-70'), 18, 'B'),
(5, (SELECT id FROM materials WHERE code='GLOVE-100'), 25, 'C'),
(5, (SELECT id FROM materials WHERE code='SYRINGE-100'), 12, 'A'),
(5, (SELECT id FROM materials WHERE code='TUBE-PLASTIC'), 15, 'D');

-- Chi tiết Phiếu 6 (rejected) - Vật tư có sẵn
INSERT INTO issue_req_detail(header_id, material_id, qty_requested, material_category) VALUES
(6, (SELECT id FROM materials WHERE code='ETH96-500'), 50, 'B'),
(6, (SELECT id FROM materials WHERE code='GLOVE-100'), 100, 'C'),
(6, (SELECT id FROM materials WHERE code='PARA500-100'), 30, 'A');

-- Chi tiết Phiếu 7 (pending) - CÓ VẬT TƯ MỚI (material_id = NULL)
INSERT INTO issue_req_detail(header_id, material_id, material_name, spec, unit_id, qty_requested, proposed_code, proposed_manufacturer, material_category) VALUES
(7, NULL, 'Hóa chất XYZ mới', 'Lọ 250ml', (SELECT id FROM units WHERE name='lọ'), 10, 'XYZ-NEW-250', 'NewChem Co', 'A'),
(7, NULL, 'Dụng cụ thí nghiệm đặc biệt', 'Bộ 5 cái', (SELECT id FROM units WHERE name='bộ'), 2, 'SPECIAL-EQ-5', 'LabInnovate', 'B'),
(7, (SELECT id FROM materials WHERE code='GLOVE-100'), NULL, NULL, NULL, 15, NULL, NULL, 'C');

-- ============================================
-- DỮ LIỆU NHẬP/XUẤT KHO
-- ============================================

-- Receipt
INSERT INTO receipt_header(created_by, received_from, reason, receipt_date, total_amount) VALUES
((SELECT id FROM users WHERE email='thukho@gmail.com'), 'Công ty Vật tư Khoa học ABC', 'Nhập theo hợp đồng 01/2025', CURRENT_DATE, 0);

INSERT INTO receipt_detail(header_id, material_id, name, spec, code, unit_id, price, qty_doc, qty_actual, lot_number, mfg_date, exp_date, total)
SELECT h.id, m.id, m.name, m.spec, m.code, m.unit_id,
        p, q, q, lot, mfg, exp, p*q
FROM (
  SELECT 'ETH96-500' code, 120000::NUMERIC(18,2) p, 100::NUMERIC(18,3) q, 'ETH-0125-A' lot, DATE '2025-01-10' mfg, DATE '2027-01-10' exp
  UNION ALL SELECT 'GLOVE-100', 80000,  200, 'GLO-0125-B',  '2025-01-15', '2026-01-15'
  UNION ALL SELECT 'MASK-50',   50000,  150, 'MSK-0125-C',  '2025-01-20', '2026-01-20'
) x
JOIN materials m ON m.code=x.code
JOIN receipt_header h ON h.receipt_date=CURRENT_DATE;

UPDATE receipt_header rh
SET total_amount = COALESCE((SELECT SUM(total) FROM receipt_detail rd WHERE rd.header_id = rh.id),0)
WHERE rh.id IN (SELECT id FROM receipt_header);

-- Issue
-- Lưu ý: Không thể thêm Manufacturer/Country vào đây vì dữ liệu seed không có.
-- Backend sẽ cần phải populate các trường này khi tạo Issue từ Issue Request.
INSERT INTO issue_header(created_by, receiver_name, department_id, issue_date, total_amount) VALUES
((SELECT id FROM users WHERE email='thukho@gmail.com'), 'Bộ môn BHPT', (SELECT id FROM departments WHERE name='Khoa xét nghiệm'), CURRENT_DATE, 0);

INSERT INTO issue_detail(header_id, material_id, name, spec, code, unit_id, unit_price, qty_requested, qty_issued, total)
SELECT h.id, m.id, m.name, m.spec, m.code, m.unit_id,
        p, qr, qi, p*qi
FROM (
  SELECT 'ETH96-500' code, 120000::NUMERIC(18,2) p, 10::NUMERIC(18,3) qr, 10::NUMERIC(18,3) qi
  UNION ALL SELECT 'GLOVE-100', 80000, 20, 20
  UNION ALL SELECT 'MASK-50',   50000,  5,  5
) x
JOIN materials m ON m.code=x.code
JOIN issue_header h ON h.issue_date=CURRENT_DATE;

UPDATE issue_header ih
SET total_amount = COALESCE((SELECT SUM(total) FROM issue_detail idt WHERE idt.header_id = ih.id),0)
WHERE ih.id IN (SELECT id FROM issue_header);

-- Inventory card example
INSERT INTO inventory_card(material_id, unit_id, warehouse_name, record_date, opening_stock, qty_in, qty_out, supplier, lot_number, mfg_date, exp_date, sub_department_id)
SELECT m.id, m.unit_id, 'Kho Hóa chất', CURRENT_DATE, 0, 100, 10, 'Cty ABC', 'ETH-0125-A', '2025-01-10', '2027-01-10',
        (SELECT id FROM sub_departments WHERE name='BHPT')
FROM materials m WHERE m.code='ETH96-500';

-- ============================================
-- THÔNG BÁO HỆ THỐNG
-- ============================================

-- Thông báo cho lãnh đạo về phiếu mới
INSERT INTO notifications(user_id, entity_type, entity_id, event_type, title, content, is_read, created_at) VALUES
((SELECT id FROM users WHERE email='lanhdao@gmail.com'), 0, 2, 0, 'Phiếu xin lĩnh mới #2 cần phê duyệt', 'Có phiếu xin lĩnh #2 từ CB Hóa sinh cần phê duyệt', false, NOW() - INTERVAL '2 days'),
((SELECT id FROM users WHERE email='lanhdao@gmail.com'), 0, 3, 0, 'Phiếu xin lĩnh mới #3 cần phê duyệt', 'Có phiếu xin lĩnh #3 từ CB Vi sinh cần phê duyệt', false, NOW() - INTERVAL '1 day'),
((SELECT id FROM users WHERE email='lanhdao@gmail.com'), 0, 4, 0, 'Phiếu xin lĩnh mới #4 cần phê duyệt', 'Có phiếu xin lĩnh #4 từ CB Khám bệnh cần phê duyệt', false, NOW() - INTERVAL '12 hours'),
((SELECT id FROM users WHERE email='lanhdao@gmail.com'), 0, 5, 0, 'Phiếu xin lĩnh mới #5 cần phê duyệt', 'Có phiếu xin lĩnh #5 từ CB Cấp cứu cần phê duyệt', false, NOW() - INTERVAL '6 hours'),
((SELECT id FROM users WHERE email='lanhdao@gmail.com'), 0, 7, 0, 'Phiếu xin lĩnh mới #7 cần phê duyệt', 'Có phiếu xin lĩnh #7 từ CB Hóa sinh có vật tư mới cần phê duyệt', false, NOW() - INTERVAL '1 day');

-- Thông báo đã đọc (lịch sử)
INSERT INTO notifications(user_id, entity_type, entity_id, event_type, title, content, is_read, created_at, read_at) VALUES
((SELECT id FROM users WHERE email='lanhdao@gmail.com'), 0, 1, 1, 'Phiếu xin lĩnh #1 đã được phê duyệt', 'Phiếu xin lĩnh #1 đã được phê duyệt và xuất kho', true, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
((SELECT id FROM users WHERE email='lanhdao@gmail.com'), 0, 6, 2, 'Phiếu xin lĩnh #6 đã bị từ chối', 'Phiếu xin lĩnh #6 đã bị từ chối do vượt quá định mức', true, NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days');

COMMIT;