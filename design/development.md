# Development Notes
## Set up
- Install globally:
    - Node.js (>= 8.9.3)
    - Heroku CLI tool
- Create new twitter app on <https://apps.twitter.com>.
- Create Heroku app.
- Create `.env` file based on `.env-sample`.
- Configure heroku variables with ``heroku config:set`` commands or on the web.

```sh
npm install
```

## Watch

```sh
npm run watch
```

## Deploy

```sh
git checkout heroku
git merge <commit-ref>
git push origin heroku
```
