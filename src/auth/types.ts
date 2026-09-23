export type Role =
  | "ADMIN"
  | "PARENT_REPRESENTATIVE"
  | "TREASURER";

export interface AuthenticatedIdentity {
  email: string;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  active: boolean;
  roles: UserRole[];
}

export interface UserRole {
  role: Role;
  classId: number | null;
}

export interface AuthContext {
  identity: AuthenticatedIdentity;
  user: AuthenticatedUser;
}
