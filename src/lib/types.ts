export interface Tag {
  id: number;
  name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface CreateLinkPayload {
  link: string;
  title?: string;
  tags?: number[];
  newTags?: string[];
}

export interface UpdateLinkPayload {
  title?: string;
  tags?: number[];
  newTags?: string[];
}

export interface ExistingLink {
  id: number;
  title: string | null;
  link: string;
  tags: Tag[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
