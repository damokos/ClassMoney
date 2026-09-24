export interface Child {
  id: number;
  classId: number;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChildInput {
  classId: number;
  name: string;
}

export interface UpdateChildInput {
  name?: string;
  active?: boolean;
}
