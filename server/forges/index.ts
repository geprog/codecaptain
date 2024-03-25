import { Gitlab } from './gitlab';
import { Forge as ForgeModel, userForgesSchema } from '~/server/schemas';
import { Github } from './github';
import { Credentials, Forge, ForgeUser, Issue, PaginatedList, Pagination, Repo, Tokens, UserWithTokens } from './types';
import { eq } from 'drizzle-orm';

export class ForgeApi {
  private user: UserWithTokens;
  private forge: Forge;

  constructor(user: UserWithTokens, forge: Forge) {
    this.user = user;
    this.forge = forge;
  }

  private async refreshTokenIfNeeded(user: UserWithTokens): Promise<Tokens> {
    // skip refreshing tokens if they don't expire (e.g. Github)
    if (user.tokens.accessTokenExpiresIn === -1) {
      return user.tokens;
    }

    if (user.tokens.accessTokenExpiresIn * 1000 > Date.now()) {
      return user.tokens;
    }

    if (!user.tokens.refreshToken) {
      throw new Error("Can't refresh token as refresh token is missing");
    }

    // refresh token
    const newTokens = await this.forge.refreshToken(user.tokens.refreshToken);
    user.tokens = newTokens;

    await db
      .update(userForgesSchema)
      .set({ accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken })
      .where(eq(userForgesSchema.userId, user.id))
      .run();

    return newTokens;
  }

  public async getCloneCredentials(): Promise<Credentials> {
    const { accessToken } = await this.refreshTokenIfNeeded(this.user);

    return this.forge.getCloneCredentials(accessToken);
  }

  public async getUserInfo(): Promise<ForgeUser> {
    const { accessToken } = await this.refreshTokenIfNeeded(this.user);

    return this.forge.getUserInfo(accessToken);
  }

  public async getRepos(search?: string, pagination?: Pagination): Promise<PaginatedList<Repo>> {
    const { accessToken } = await this.refreshTokenIfNeeded(this.user);

    return this.forge.getRepos(accessToken, search, pagination);
  }

  public async getRepo(repoId: string): Promise<Repo> {
    const { accessToken } = await this.refreshTokenIfNeeded(this.user);

    return this.forge.getRepo(accessToken, repoId);
  }

  public async getIssues(repoId: string, pagination?: Pagination): Promise<PaginatedList<Issue>> {
    const { accessToken } = await this.refreshTokenIfNeeded(this.user);

    return this.forge.getIssues(accessToken, repoId, pagination);
  }
}

export function getForgeFromDB(forge: ForgeModel): Forge {
  switch (forge.type) {
    case 'github':
      return new Github(forge);
    case 'gitlab':
      return new Gitlab(forge);
    default:
      throw new Error(`Unknown forge type: ${forge.type}`);
  }
}
