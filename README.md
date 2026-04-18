# CPU Didatica

Interactive CPU simulator built with React, TypeScript, Vite, Zustand, and Tailwind CSS.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

The app is served on `http://localhost:3000` by default.

## Available Scripts

- `npm run dev`: start Vite dev server
- `npm run build`: create a production bundle
- `npm run start`: preview the production build locally
- `npm run preview`: same as `start`
- `npm run lint`: run ESLint

## Project Structure

- `src/main.tsx`: Vite entry point
- `src/App.tsx`: app shell + route mapping
- `app/page.tsx`: simulator workspace page
- `app/config/page.tsx`: configuration/help page
- `components/*`: UI components and canvas widgets
- `lib/*`: stores, simulator state orchestration, and domain logic

## Notes

- There is currently no `npm test` script.
- Projects can be imported/exported as `.cpud` files.
