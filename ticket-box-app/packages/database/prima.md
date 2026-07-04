# How to run Prisma + TS build

All commands must be run from the database package directory:

```
cd ticket-box-app/packages/database/
```

## 1. Set environment variable

Make sure `DATABASE_URL` is available. It lives in `./ticket-box-app/.env`:

## 2. Install
```
npm install
```


## 3. Validate `schema.prisma`

```bash
npx dotenv-cli -e ../../.env -- npx prisma validate --schema=./prisma/schema.prisma
```

## 4. Generate Prisma client serves import to nother modules

```bash
npx prisma generate --schema=./prisma/schema.prisma
```

Generated client lands in `node_modules/@prisma/client`.

## 5. TypeScript build - compile Typescript to Javascript

```bash
npx tsc -p tsconfig.json
```

Output lands in `dist/`. Exports: `index.js`, `client.js`, `ticketing.js`, `checkin.js`.