import type { Class } from "../domain/classes/types";
import { ConflictError, NotFoundError } from "../http/errors";

export function requireActiveClass(classItem: Class | null): asserts classItem is Class {
  if (!classItem) throw new NotFoundError("Class not found");
  if (!classItem.active) throw new ConflictError("Archived classes are read-only");
}
