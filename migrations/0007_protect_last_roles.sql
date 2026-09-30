CREATE TRIGGER protect_last_required_role
BEFORE DELETE ON user_roles
WHEN
  (OLD.role = 'ADMIN' AND OLD.class_id IS NULL AND
    (SELECT COUNT(*) FROM user_roles WHERE role = 'ADMIN' AND class_id IS NULL) <= 1)
  OR (OLD.role = 'TREASURER' AND OLD.class_id IS NOT NULL AND
    (SELECT COUNT(*) FROM user_roles WHERE role = 'TREASURER' AND class_id = OLD.class_id) <= 1)
  OR (OLD.role = 'PARENT_REPRESENTATIVE' AND OLD.class_id IS NOT NULL AND
    (SELECT COUNT(*) FROM user_roles WHERE role = 'PARENT_REPRESENTATIVE' AND class_id = OLD.class_id) <= 1)
BEGIN
  SELECT RAISE(ABORT, 'Cannot remove the last required role');
END;
