# codecaptain.ai

A dev advisor to ask about your code and project

## How to start the python server

Use the command `python uvicorn pyserver:app --reload --app-dir=ai` to start the python server. It takes default port 8000.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/geprog/codecaptain)

## Database

Codecaptain is using [Drizzle ORM](https://orm.drizzle.team) and sqlite.

### Migrations

- To generate new migrations run: `pnpm db:generate-migration`
- To migrate the database and seed it run: `pnpm db:up`
- To open the database explorer run: `pnpm db:explorer`

## Appreciations

- https://hackernoon.com/reverse-engineering-reddits-source-code-with-langchain-and-gpt-4
- https://js.langchain.com/docs/use_cases/code_understanding
