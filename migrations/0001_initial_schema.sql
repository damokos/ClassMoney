-- ClassMoney
-- Initial D1 / SQLite schema
-- Generated from the finalized logical data model.
-- Migration: 0001_initial_schema.sql

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- ============================================================
-- 1. Classes
-- ============================================================

CREATE TABLE classes (
    id                INTEGER PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    display_name      TEXT NOT NULL,
    currency          TEXT NOT NULL,
    currency_decimals INTEGER NOT NULL,
    balance           INTEGER NOT NULL DEFAULT 0,
    timezone          TEXT NOT NULL,
    active            INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    archived_at       TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,

    CHECK (length(trim(code)) > 0),
    CHECK (length(trim(display_name)) > 0),
    CHECK (length(currency) = 3),
    CHECK (currency_decimals BETWEEN 0 AND 3),
    CHECK (
        (active = 1 AND archived_at IS NULL)
        OR
        (active = 0 AND archived_at IS NOT NULL)
    )
);

CREATE INDEX idx_classes_active
    ON classes(active);


-- ============================================================
-- 2. Users
-- ============================================================

CREATE TABLE users (
    id          INTEGER PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,

    CHECK (length(trim(email)) > 0)
);


-- ============================================================
-- 3. User roles
-- ============================================================

CREATE TABLE user_roles (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    class_id    INTEGER,
    role        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    created_by  INTEGER,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CHECK (role IN (
        'ADMIN',
        'PARENT_REPRESENTATIVE',
        'TREASURER'
    )),

    -- ADMIN is global; the other roles are class-scoped.
    CHECK (
        (role = 'ADMIN' AND class_id IS NULL)
        OR
        (role IN ('PARENT_REPRESENTATIVE', 'TREASURER') AND class_id IS NOT NULL)
    )

    -- Uniqueness is enforced by partial unique indexes below because
    -- SQLite permits multiple NULL values in UNIQUE constraints.
);

CREATE UNIQUE INDEX uq_user_roles_admin
    ON user_roles(user_id)
    WHERE role = 'ADMIN';

CREATE UNIQUE INDEX uq_user_roles_class_role
    ON user_roles(user_id, class_id, role)
    WHERE role IN ('PARENT_REPRESENTATIVE', 'TREASURER');

CREATE INDEX idx_user_roles_user
    ON user_roles(user_id);

CREATE INDEX idx_user_roles_class
    ON user_roles(class_id);

CREATE INDEX idx_user_roles_class_role
    ON user_roles(class_id, role);


-- ============================================================
-- 4. Children
-- ============================================================

CREATE TABLE children (
    id          INTEGER PRIMARY KEY,
    class_id    INTEGER NOT NULL,
    name        TEXT NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    CHECK (length(trim(name)) > 0),

    -- Supports composite FKs from class-scoped resources.
    UNIQUE (class_id, id)
);

CREATE INDEX idx_children_class
    ON children(class_id);

CREATE INDEX idx_children_class_active
    ON children(class_id, active);


-- ============================================================
-- 5. User <-> Child
-- ============================================================

CREATE TABLE user_children (
    user_id   INTEGER NOT NULL,
    child_id  INTEGER NOT NULL,

    PRIMARY KEY (user_id, child_id),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (child_id)
        REFERENCES children(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_user_children_child
    ON user_children(child_id);


-- ============================================================
-- 6. Charge batches
-- ============================================================

CREATE TABLE charge_batches (
    id          INTEGER PRIMARY KEY,
    class_id    INTEGER NOT NULL,
    created_at  TEXT NOT NULL,
    created_by  INTEGER NOT NULL,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    UNIQUE (class_id, id)
);

CREATE INDEX idx_charge_batches_class
    ON charge_batches(class_id);


-- ============================================================
-- 7. Charges
-- ============================================================

CREATE TABLE charges (
    id             INTEGER PRIMARY KEY,
    class_id       INTEGER NOT NULL,
    child_id       INTEGER NOT NULL,
    title          TEXT NOT NULL,
    amount         INTEGER NOT NULL,
    due_date       TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'PENDING',
    paid_at        TEXT,
    paid_by        INTEGER,
    cancelled_at   TEXT,
    cancelled_by   INTEGER,
    batch_id       INTEGER,
    created_at     TEXT NOT NULL,
    created_by     INTEGER NOT NULL,

    FOREIGN KEY (class_id, child_id)
        REFERENCES children(class_id, id)
        ON DELETE RESTRICT,

    FOREIGN KEY (class_id, batch_id)
        REFERENCES charge_batches(class_id, id)
        ON DELETE RESTRICT,

    FOREIGN KEY (paid_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (cancelled_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CHECK (length(trim(title)) > 0),
    CHECK (amount > 0),
    CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),

    CHECK (
        (status = 'PENDING' AND paid_at IS NULL AND paid_by IS NULL
            AND cancelled_at IS NULL AND cancelled_by IS NULL)
        OR
        (status = 'PAID' AND paid_at IS NOT NULL AND paid_by IS NOT NULL
            AND cancelled_at IS NULL AND cancelled_by IS NULL)
        OR
        (status = 'CANCELLED'
            AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
            AND (
                (paid_at IS NULL AND paid_by IS NULL)
                OR
                (paid_at IS NOT NULL AND paid_by IS NOT NULL)
            ))
    ),

    UNIQUE (class_id, id)
);

CREATE INDEX idx_charges_class
    ON charges(class_id);

CREATE INDEX idx_charges_child
    ON charges(child_id);

CREATE INDEX idx_charges_class_child
    ON charges(class_id, child_id);

CREATE INDEX idx_charges_status
    ON charges(class_id, status);

CREATE INDEX idx_charges_batch
    ON charges(batch_id);


-- ============================================================
-- 8. Financial transaction categories
-- ============================================================

CREATE TABLE financial_transaction_categories (
    id                   INTEGER PRIMARY KEY,
    code                 TEXT NOT NULL UNIQUE,
    name                 TEXT NOT NULL,
    active               INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    allows_signed_amount INTEGER NOT NULL DEFAULT 0 CHECK (allows_signed_amount IN (0, 1)),
    created_at           TEXT NOT NULL,
    created_by           INTEGER,

    CHECK (length(trim(code)) > 0),
    CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_financial_transaction_categories_active
    ON financial_transaction_categories(active);


-- ============================================================
-- 9. Financial transactions
-- ============================================================

CREATE TABLE financial_transactions (
    id                 INTEGER PRIMARY KEY,
    class_id           INTEGER NOT NULL,
    category_id        INTEGER NOT NULL,
    description        TEXT NOT NULL,
    amount             INTEGER NOT NULL,
    status             TEXT NOT NULL DEFAULT 'UNPAID',
    receipt_key        TEXT,
    receipt_mime_type  TEXT,
    created_at         TEXT NOT NULL,
    created_by         INTEGER NOT NULL,
    paid_at            TEXT,
    paid_by            INTEGER,
    cancelled_at       TEXT,
    cancelled_by       INTEGER,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (category_id)
        REFERENCES financial_transaction_categories(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (paid_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (cancelled_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CHECK (length(trim(description)) > 0),
    CHECK (amount <> 0),
    CHECK (status IN ('UNPAID', 'PAID', 'CANCELLED')),

    CHECK (
        (status = 'UNPAID' AND paid_at IS NULL AND paid_by IS NULL
            AND cancelled_at IS NULL AND cancelled_by IS NULL)
        OR
        (status = 'PAID' AND paid_at IS NOT NULL AND paid_by IS NOT NULL
            AND cancelled_at IS NULL AND cancelled_by IS NULL)
        OR
        (status = 'CANCELLED'
            AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
            AND (
                (paid_at IS NULL AND paid_by IS NULL)
                OR
                (paid_at IS NOT NULL AND paid_by IS NOT NULL)
            ))
    ),

    CHECK (
        receipt_key IS NULL
        OR receipt_mime_type IS NOT NULL
    )
);

CREATE INDEX idx_financial_transactions_class
    ON financial_transactions(class_id);

CREATE INDEX idx_financial_transactions_class_status
    ON financial_transactions(class_id, status);

CREATE INDEX idx_financial_transactions_category
    ON financial_transactions(category_id);

-- SQLite CHECK constraints cannot reference another table, so the
-- category-dependent sign rule is enforced with triggers.
CREATE TRIGGER trg_financial_transactions_amount_insert
BEFORE INSERT ON financial_transactions
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1
            FROM financial_transaction_categories c
            WHERE c.id = NEW.category_id
              AND c.code <> 'FINANCIAL_ADJUSTMENT'
        )
        AND NEW.amount <= 0
        THEN RAISE(ABORT, 'amount must be positive for this financial transaction category')
        WHEN EXISTS (
            SELECT 1
            FROM financial_transaction_categories c
            WHERE c.id = NEW.category_id
        )
        AND NEW.amount = 0
        THEN RAISE(ABORT, 'amount must not be zero')
        WHEN NOT EXISTS (
            SELECT 1
            FROM financial_transaction_categories c
            WHERE c.id = NEW.category_id
        )
        THEN RAISE(ABORT, 'invalid financial transaction category')
    END;
END;

CREATE TRIGGER trg_financial_transactions_amount_update
BEFORE UPDATE OF category_id, amount ON financial_transactions
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1
            FROM financial_transaction_categories c
            WHERE c.id = NEW.category_id
              AND c.code <> 'FINANCIAL_ADJUSTMENT'
        )
        AND NEW.amount <= 0
        THEN RAISE(ABORT, 'amount must be positive for this financial transaction category')
        WHEN EXISTS (
            SELECT 1
            FROM financial_transaction_categories c
            WHERE c.id = NEW.category_id
        )
        AND NEW.amount = 0
        THEN RAISE(ABORT, 'amount must not be zero')
        WHEN NOT EXISTS (
            SELECT 1
            FROM financial_transaction_categories c
            WHERE c.id = NEW.category_id
        )
        THEN RAISE(ABORT, 'invalid financial transaction category')
    END;
END;


-- ============================================================
-- 10. Expenses
-- ============================================================

CREATE TABLE expenses (
    id                 INTEGER PRIMARY KEY,
    class_id           INTEGER NOT NULL,
    expense_date       TEXT NOT NULL,
    title              TEXT NOT NULL,
    category           TEXT NOT NULL,
    amount             INTEGER NOT NULL,
    status             TEXT NOT NULL DEFAULT 'UNPAID',
    receipt_key        TEXT,
    receipt_mime_type  TEXT,
    created_at         TEXT NOT NULL,
    created_by         INTEGER NOT NULL,
    paid_at            TEXT,
    paid_by            INTEGER,
    cancelled_at       TEXT,
    cancelled_by       INTEGER,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (paid_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (cancelled_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CHECK (length(trim(title)) > 0),
    CHECK (length(trim(category)) > 0),
    CHECK (amount > 0),
    CHECK (status IN ('UNPAID', 'PAID', 'CANCELLED')),

    CHECK (
        (status = 'UNPAID' AND paid_at IS NULL AND paid_by IS NULL
            AND cancelled_at IS NULL AND cancelled_by IS NULL)
        OR
        (status = 'PAID' AND paid_at IS NOT NULL AND paid_by IS NOT NULL
            AND cancelled_at IS NULL AND cancelled_by IS NULL)
        OR
        (status = 'CANCELLED'
            AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
            AND (
                (paid_at IS NULL AND paid_by IS NULL)
                OR
                (paid_at IS NOT NULL AND paid_by IS NOT NULL)
            ))
    ),

    CHECK (
        receipt_key IS NOT NULL
        AND receipt_mime_type IS NOT NULL
    )
);

CREATE INDEX idx_expenses_class
    ON expenses(class_id);

CREATE INDEX idx_expenses_class_status
    ON expenses(class_id, status);

CREATE INDEX idx_expenses_date
    ON expenses(class_id, expense_date);


-- ============================================================
-- 11. Balance transaction ledger
-- ============================================================

CREATE TABLE balance_transactions (
    id               INTEGER PRIMARY KEY,
    class_id         INTEGER NOT NULL,
    amount           INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    reference_type   TEXT NOT NULL,
    reference_id     INTEGER NOT NULL,
    description      TEXT,
    created_at       TEXT NOT NULL,
    created_by       INTEGER NOT NULL,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CHECK (amount <> 0),

    CHECK (transaction_type IN (
        'INITIAL_BALANCE',
        'CHARGE_PAID',
        'CHARGE_CANCELLED',
        'EXPENSE_PAID',
        'EXPENSE_CANCELLED',
        'FINANCIAL_TRANSACTION_PAID',
        'FINANCIAL_TRANSACTION_CANCELLED'
    )),

    CHECK (reference_type IN (
        'class',
        'charge',
        'expense',
        'financial_transaction'
    ))
);

CREATE INDEX idx_balance_transactions_class
    ON balance_transactions(class_id, id);

CREATE INDEX idx_balance_transactions_reference
    ON balance_transactions(reference_type, reference_id);

CREATE INDEX idx_balance_transactions_type
    ON balance_transactions(class_id, transaction_type);


-- ============================================================
-- 12. Audit log
-- ============================================================

CREATE TABLE audit_log (
    id             INTEGER PRIMARY KEY,
    actor_user_id  INTEGER,
    class_id       INTEGER,
    entity_type    TEXT NOT NULL,
    entity_id      INTEGER NOT NULL,
    action         TEXT NOT NULL,
    metadata       TEXT,
    created_at     TEXT NOT NULL,

    FOREIGN KEY (actor_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    CHECK (length(trim(entity_type)) > 0),
    CHECK (length(trim(action)) > 0),

    CHECK (
        metadata IS NULL
        OR json_valid(metadata)
    )
);

CREATE INDEX idx_audit_log_class
    ON audit_log(class_id, created_at);

CREATE INDEX idx_audit_log_entity
    ON audit_log(entity_type, entity_id, created_at);

CREATE INDEX idx_audit_log_actor
    ON audit_log(actor_user_id, created_at);


-- ============================================================
-- 13. Notifications
-- ============================================================

CREATE TABLE notification_types (
    id          INTEGER PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at  TEXT NOT NULL,
    created_by  INTEGER,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CHECK (length(trim(code)) > 0),
    CHECK (length(trim(name)) > 0)
);

CREATE TABLE notification_type_roles (
    notification_type_id INTEGER NOT NULL,
    role                 TEXT NOT NULL,

    PRIMARY KEY (notification_type_id, role),

    FOREIGN KEY (notification_type_id)
        REFERENCES notification_types(id)
        ON DELETE CASCADE,

    CHECK (role IN (
        'ADMIN',
        'PARENT_REPRESENTATIVE',
        'TREASURER'
    ))
);

CREATE INDEX idx_notification_type_roles_role
    ON notification_type_roles(role);


CREATE TABLE notification_preferences (
    id                   INTEGER PRIMARY KEY,
    user_id              INTEGER NOT NULL,
    notification_type_id INTEGER NOT NULL,
    enabled              INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (notification_type_id)
        REFERENCES notification_types(id)
        ON DELETE CASCADE,

    UNIQUE (user_id, notification_type_id)
);

CREATE INDEX idx_notification_preferences_user
    ON notification_preferences(user_id);


CREATE TABLE notification_events (
    id                   INTEGER PRIMARY KEY,
    notification_type_id INTEGER NOT NULL,
    user_id              INTEGER,
    class_id             INTEGER,
    entity_type          TEXT,
    entity_id            INTEGER,
    payload              TEXT,
    status               TEXT NOT NULL DEFAULT 'PENDING',
    created_at           TEXT NOT NULL,
    sent_at              TEXT,
    failed_at            TEXT,
    error_message        TEXT,

    FOREIGN KEY (notification_type_id)
        REFERENCES notification_types(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    CHECK (status IN ('PENDING', 'SENT', 'FAILED')),

    CHECK (
        payload IS NULL
        OR json_valid(payload)
    )
);

CREATE INDEX idx_notification_events_pending
    ON notification_events(status, created_at);

CREATE INDEX idx_notification_events_user
    ON notification_events(user_id, created_at);

CREATE INDEX idx_notification_events_class
    ON notification_events(class_id, created_at);


-- ============================================================
-- 14. Initial notification types and role permissions
-- ============================================================

-- Notification permissions are role-based and intentionally data-driven.
-- New notification types and role mappings can be added without changing
-- the notification schema. The UI provides localized labels.

INSERT INTO notification_types (code, name, description, active, created_at, created_by) VALUES
('CHARGE_ASSIGNED_OR_CANCELLED_FOR_MY_CHILD', 'Charge assigned or cancelled for my child', NULL, 1, '1970-01-01T00:00:00Z', NULL),
('CHARGE_DUE_SOON', 'Charge due soon', NULL, 1, '1970-01-01T00:00:00Z', NULL),
('CHARGE_MARKED_PAID', 'Charge marked as paid', NULL, 1, '1970-01-01T00:00:00Z', NULL),
('EXPENSE_CREATED', 'New expense recorded', NULL, 1, '1970-01-01T00:00:00Z', NULL),
('CHARGE_ASSIGNED_OR_CANCELLED', 'Charge assigned or cancelled', NULL, 1, '1970-01-01T00:00:00Z', NULL),
('EXPENSE_CANCELLED', 'Expense cancelled', NULL, 1, '1970-01-01T00:00:00Z', NULL),
('EXPENSE_MARKED_PAID', 'Expense marked as paid', NULL, 1, '1970-01-01T00:00:00Z', NULL);

INSERT INTO notification_type_roles (notification_type_id, role)
SELECT id, 'PARENT_REPRESENTATIVE'
FROM notification_types
WHERE code IN (
    'CHARGE_ASSIGNED_OR_CANCELLED',
    'EXPENSE_CANCELLED'
);

INSERT INTO notification_type_roles (notification_type_id, role)
SELECT id, 'PARENT_REPRESENTATIVE'
FROM notification_types
WHERE code IN (
    'CHARGE_ASSIGNED_OR_CANCELLED_FOR_MY_CHILD',
    'CHARGE_DUE_SOON',
    'CHARGE_MARKED_PAID',
    'EXPENSE_CREATED'
);

INSERT INTO notification_type_roles (notification_type_id, role)
SELECT id, 'TREASURER'
FROM notification_types
WHERE code IN (
    'CHARGE_MARKED_PAID',
    'EXPENSE_MARKED_PAID'
);


-- ============================================================
-- 15. Initial financial transaction categories
-- ============================================================

-- created_at / created_by are intentionally left to the application
-- for normal runtime-created records. Seed rows use a fixed epoch
-- timestamp and NULL actor because they are schema initialization data.

INSERT INTO financial_transaction_categories (
    code,
    name,
    active,
    allows_signed_amount,
    created_at,
    created_by
) VALUES
(
    'OTHER',
    'Other',
    1,
    0,
    '1970-01-01T00:00:00Z',
    NULL
),
(
    'FINANCIAL_ADJUSTMENT',
    'Financial adjustment',
    1,
    1,
    '1970-01-01T00:00:00Z',
    NULL
);

COMMIT;
