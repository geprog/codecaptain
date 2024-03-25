import { H3Event } from 'h3';
import { User } from '~/server/schemas';

export type Tokens = { accessToken: string; accessTokenExpiresIn: number; refreshToken: string | null };

export type Credentials = {
  username: string;
  password: string;
};

export type UserWithTokens = User & { tokens: Tokens };

export type ForgeUser = Omit<User, 'id'> & { remoteUserId: string };

export type Pagination = {
  page: number;
  perPage: number;
  since?: Date;
};

export type PaginatedList<T> = {
  items: T[];
  total: number;
};

export type Repo = {
  name: string;
  cloneUrl: string;
  defaultBranch: string;
  forgeId: number;
  id: number;
  url: string;
  avatarUrl?: string;
};

export type Comment = {
  body: string;
  author: {
    login: string;
    name: string;
  };
};

export type Issue = {
  title: string;
  description: string;
  number: number;
  labels: string[];
  comments: Comment[];
};

export interface Forge {
  getOauthRedirectUrl(o: { state: string; redirectUri: string }): string;
  refreshToken(refreshToken: string): Promise<Tokens>;
  oauthCallback(event: H3Event): Promise<Tokens>;
  getUserInfo(token: string): Promise<ForgeUser>;
  getCloneCredentials(token: string): Promise<Credentials>;
  getRepos(token: string, search?: string, pagination?: Pagination): Promise<PaginatedList<Repo>>;
  getRepo(token: string, repoId: string): Promise<Repo>;
  getIssues(token: string, repoId: string, pagination?: Pagination): Promise<PaginatedList<Issue>>;
}
