import type { H3Event } from 'h3';
import { Forge, Tokens, Credentials, ForgeUser, Repo, Pagination, PaginatedList, Issue } from './types';
import { Forge as DBForge } from '~/server/schemas';
import { Gitlab as GitlabApi } from '@gitbeaker/rest';

export class Gitlab implements Forge {
  private host: string;
  private clientId: string;
  private clientSecret: string;
  private forgeId: number;

  constructor(forge: DBForge) {
    this.host = forge.host || 'gitlab.com';
    this.clientId = forge.clientId;
    this.clientSecret = forge.clientSecret;
    this.forgeId = forge.id;
  }

  public async getCloneCredentials(token: string): Promise<Credentials> {
    return {
      username: 'oauth2',
      password: token,
    };
  }

  public getClient(token: string) {
    return new GitlabApi({
      host: `https://${this.host}`,
      oauthToken: token,
    });
  }

  public getOauthRedirectUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const scopes = ['read_user', 'read_repository', 'read_api', 'email', 'profile'];
    return `https://${this.host}/oauth/authorize?client_id=${
      this.clientId
    }&response_type=code&redirect_uri=${redirectUri}&state=${state}&scope=${scopes.join('%20')}`;
  }

  public async getUserInfo(token: string): Promise<ForgeUser> {
    const client = this.getClient(token);
    const gitlabUser = await client.Users.showCurrentUser();
    return {
      name: gitlabUser.name,
      avatarUrl: gitlabUser.avatar_url,
      email: gitlabUser.email,
      remoteUserId: gitlabUser.id.toString(),
    };
  }

  public async oauthCallback(event: H3Event): Promise<Tokens> {
    const { code } = getQuery(event);
    if (!code) {
      throw new Error('No code provided');
    }

    const config = useRuntimeConfig();
    const redirectUri = `${config.public.APP_URL}/api/auth/callback`;
    const response: any = await $fetch(`https://${this.host}/oauth/token`, {
      method: 'POST',
      body: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      },
      ignoreResponseError: true,
    });
    if (response.error) {
      console.error(response);
      throw new Error('Error getting access token');
    }

    return {
      accessToken: response.access_token,
      accessTokenExpiresIn: response.expires_in,
      refreshToken: response.refresh_token,
    };
  }

  public async refreshToken(refreshToken: string): Promise<Tokens> {
    const response: any = await $fetch(`https://${this.host}/oauth/token`, {
      method: 'POST',
      body: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      },
      ignoreResponseError: true,
    });
    if (response.error) {
      console.error(response);
      throw new Error('Error refreshing access token');
    }

    return {
      accessToken: response.access_token,
      accessTokenExpiresIn: response.expires_in,
      refreshToken: response.refresh_token,
    };
  }

  public async getRepos(token: string, search?: string, pagination?: Pagination): Promise<PaginatedList<Repo>> {
    const client = this.getClient(token);
    const repos = await client.Projects.all({ search, membership: true, perPage: 10 });
    return {
      items: repos.map((repo) => ({
        id: repo.id,
        name: repo.name_with_namespace,
        url: repo.web_url,
        forgeId: this.forgeId,
        cloneUrl: repo.http_url_to_repo,
        defaultBranch: repo.default_branch,
        avatarUrl: this.sanitizeAvatarUrl(repo.avatar_url || repo.namespace.avatar_url),
      })),
      total: repos.length,
    };
  }

  async getRepo(token: string, repoId: string): Promise<Repo> {
    const client = this.getClient(token);
    const repo = await client.Projects.show(repoId);

    return {
      id: repo.id,
      name: repo.name_with_namespace,
      url: repo.web_url,
      forgeId: this.forgeId,
      cloneUrl: repo.http_url_to_repo,
      defaultBranch: repo.default_branch,
      avatarUrl: this.sanitizeAvatarUrl(repo.avatar_url || repo.namespace.avatar_url),
    };
  }

  async getIssues(token: string, repoId: string, pagination?: Pagination): Promise<PaginatedList<Issue>> {
    const client = this.getClient(token);

    const { data: issues, paginationInfo } = await client.Issues.all({
      projectId: repoId,
      perPage: pagination?.perPage || 10,
      page: pagination?.page || 1,
      showExpanded: true,
      updatedAfter: pagination?.since?.toISOString(),
    });

    return {
      items: issues.map((issue) => ({
        title: issue.title,
        description: issue.description,
        number: issue.iid,
        labels: issue.labels || [],
        comments: [], // TODO: get comments
      })),
      total: paginationInfo.total,
    };
  }

  private sanitizeAvatarUrl(avatarUrl: string | undefined): string | undefined {
    if (!avatarUrl) {
      return undefined;
    }

    if (avatarUrl.startsWith('/')) {
      return avatarUrl.replace('/', `https://${this.host}/`);
    }

    return avatarUrl;
  }
}
