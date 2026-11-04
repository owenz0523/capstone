# Ketchup

Capstone prototype (team Mustard): plan hangouts by collecting availability and preferences in one shared link. Scope lives in `goals.md` and `abstract.md`.

## Run

```
npm install
npm run dev        # http://localhost:3000
npm test           # scheduling unit tests
npm run typecheck
```

Data is stored in a local SQLite file (`ketchup.db`, via Node's built-in `node:sqlite`, so Node 22.13+ is required). Delete the file to reset.
