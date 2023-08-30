import type { H3Event } from 'h3';
import { Forge, Credentials, Tokens, ForgeUser, Repo, PaginatedList, Pagination, Issue } from './types';
import { Forge as DBForge } from '../schemas';
import { Octokit } from 'octokit';

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
    const repos = await client.request('GET /search/repositories', {
      q: `is:public fork:false archived:false ${search}`.trim(), // TODO: filter by owned repos
      per_page: 10,
      sort: 'updated',
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
          }) satisfies Repo,
      ),
      total: 0, // TODO
    };
  }

  async getRepo(token: string, repoId: string): Promise<Repo> {
    const client = this.getClient(token);

    const repo = await client.request(`GET /repositories/{repoId}`, {
      repoId,
    });

    // TODO: think about adding repo.data.default_branch:
    return {
      id: repo.data.id,
      name: repo.data.full_name,
      cloneUrl: repo.data.clone_url,
      forgeId: this.forgeId,
      url: repo.data.html_url,
    };
  }

  async getIssues(token: string, repoId: string, pagination?: Pagination): Promise<PaginatedList<Issue>> {
    const client = this.getClient(token);

    const repo = await client.request(`GET /repositories/{repoId}`, {
      repoId,
    });


    const issues = await client.request(`GET /repos/{owner}/{repo}/issues`, {
      owner: repo.data.owner.login,
      repo: repo.data.name,
      per_page: pagination?.perPage || 10,
      page: pagination?.page || 1,
    });

    let total = 0; //if there are no pages. It occurs when the response doesn't have link attribute in headers

    if(issues.headers.link){
      const linkToLastPage = issues.headers.link.split(',').find(link=> link.split('; ')[1]==='rel="last"');
      const totalPage = parseInt(linkToLastPage?.split('&')[1].split('=')[1].split('>')[0] || '0'); //e.g <https://api.github.com/repositories/659184353/issues?per_page=2&page=3>; rel="last"
      const perPage = parseInt(linkToLastPage?.split('?')[1].split('&')[0].split('=')[1] || '0');

      total = totalPage * perPage;

    }

      
    return {
      items: issues.data.map((issue) => ({
        title: issue.title,
        description: issue.body || '',
        number: issue.number,
        labels: issue.labels.map((label) => (typeof label === 'string' ? label : label.name || '')),
        comments: [], // TODO: get comments
      })),
      total,
    };
  }
}
