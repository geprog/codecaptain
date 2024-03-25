import type { H3Event } from 'h3';
import { Forge, Credentials, Tokens, ForgeUser, Repo, PaginatedList, Pagination, Issue } from './types';
import { Forge as DBForge } from '~/server/schemas';
import { Octokit } from 'octokit';
import type { ResponseHeaders } from '@octokit/types';

export class Github implements Forge {
  private clientId: string;
  private clientSecret: string;
  private forgeId: number;

  constructor(forge: DBForge) {
    this.clientId = forge.clientId;
    this.clientSecret = forge.clientSecret;
    this.forgeId = forge.id;
  }

  private getClient(token: string) {
    return new Octokit({
      auth: token,
    });
  }

  public async getCloneCredentials(token: string): Promise<Credentials> {
    return {
      username: 'oauth2',
      password: token,
    };
  }

  private getTotalPagesFromHeaders(headers: ResponseHeaders) {
    /*
      Sample link header:
      link:
      <https://api.github.com/repositories/1300192/issues?page=2>; rel="prev",
      <https://api.github.com/repositories/1300192/issues?page=4>; rel="next",
      <https://api.github.com/repositories/1300192/issues?page=515>; rel="last",
      <https://api.github.com/repositories/1300192/issues?page=1>; rel="first"
    */

    if (!headers.link) {
      return 0;
    }

    const linkToLastPage = headers.link.split(',').find((link) => link.includes('rel="last"'));
    if (!linkToLastPage) {
      return 0;
    }

    const match = /\?page=(.*?)\>/.exec(linkToLastPage);
    if (!match || match.length != 2) {
      return 0;
    }

    return parseInt(match[1]);
  }

  public getOauthRedirectUrl({ state }: { state: string }): string {
    const scopes = ['read:user', 'user:email', 'repo'];
    return `https://github.com/login/oauth/authorize?client_id=${
      this.clientId
    }&scope=public_repo&state=${state}&scope=${scopes.join('%20')}`;
  }

  public async getUserInfo(token: string): Promise<ForgeUser> {
    const client = this.getClient(token);
    const githubUser = await client.request('GET /user');

    return {
      name: githubUser.data.name,
      avatarUrl: githubUser.data.avatar_url,
      email: githubUser.data.email,
      remoteUserId: githubUser.data.id.toString(),
    };
  }

  public async oauthCallback(event: H3Event): Promise<Tokens> {
    const { code } = getQuery(event);

    if (!code) {
      throw new Error('No code provided');
    }
    const response: any = await $fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      body: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
      },
      ignoreResponseError: true,
    });
    if (response.error) {
      console.error(response.error);
      throw new Error('Error getting access token');
    }

    return {
      accessToken: response.access_token,
      accessTokenExpiresIn: response.expires_in || -1, // We use -1 as github access_tokens issued by oauth apps don't expire
      refreshToken: response.refresh_token || null, // Use null as oauth apps don't return refresh tokens
    };
  }

  public async refreshToken(refreshToken: string): Promise<Tokens> {
    const response: any = await $fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      body: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
    });
    if (response.error) {
      console.error(response);
      throw new Error('Error refreshing access token');
    }

    return {
      accessToken: response.access_token,
      accessTokenExpiresIn: response.expires_in,
      refreshToken: null, // TODO: we use an empty string for now as github access_tokens don't expire
    };
  }

  public async getRepos(token: string, search?: string, pagination?: Pagination): Promise<PaginatedList<Repo>> {
    const client = this.getClient(token);

    const perPage = pagination?.perPage || 10;
    const repos = await client.request('GET /search/repositories', {
      q: `is:public fork:false archived:false ${search}`.trim(), // TODO: filter by owned repos
      per_page: perPage,
      sort: 'updated',
      page: pagination?.page,
    });

    return {
      items: repos.data.items.map(
        (repo) =>
          ({
            name: repo.full_name,
            cloneUrl: repo.clone_url,
            id: repo.id,
            forgeId: this.forgeId,
            url: repo.url,
            defaultBranch: repo.default_branch,
            avatarUrl: repo.owner?.avatar_url,
          }) satisfies Repo,
      ),
      total: this.getTotalPagesFromHeaders(repos.headers) * perPage,
    };
  }

  async getRepo(token: string, repoId: string): Promise<Repo> {
    const client = this.getClient(token);

    const repo = await client.request(`GET /repositories/{repoId}`, {
      repoId,
    });

    return {
      id: repo.data.id,
      name: repo.data.full_name,
      cloneUrl: repo.data.clone_url,
      forgeId: this.forgeId,
      url: repo.data.html_url,
      defaultBranch: repo.data.default_branch,
      avatarUrl: repo.data.owner?.avatar_url,
    };
  }

  async getIssues(token: string, repoId: string, pagination?: Pagination): Promise<PaginatedList<Issue>> {
    const client = this.getClient(token);

    const repo = await client.request(`GET /repositories/{repoId}`, {
      repoId,
    });

    const perPage = pagination?.perPage || 10;
    const issues = await client.request(`GET /repos/{owner}/{repo}/issues`, {
      owner: repo.data.owner.login,
      repo: repo.data.name,
      per_page: perPage,
      page: pagination?.page,
      since: pagination?.since?.toISOString(),
    });

    return {
      items: issues.data.map((issue) => ({
        title: issue.title,
        description: issue.body || '',
        number: issue.number,
        labels: issue.labels.map((label) => (typeof label === 'string' ? label : label.name || '')),
        comments: [], // TODO: get comments
      })),
      total: this.getTotalPagesFromHeaders(issues.headers) * perPage,
    };
  }
}
