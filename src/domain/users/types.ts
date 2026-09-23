import type { Role } from "../../auth/types";

export interface User {
  id: number;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithRoles extends User {
  roles: UserRoleAssignment[];
}

export interface UserRoleAssignment {
  role: Role;
  classId: number | null;
}
