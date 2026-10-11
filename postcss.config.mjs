import path from "node:path";

const config = {
  plugins: {
    // Scopes react-advanced-odontogram's stylesheet to the chart, and acts
    // on no other file. By absolute path: Turbopack require()s each key from
    // its own build directory, where a relative one does not resolve.
    [path.join(process.cwd(), "scripts", "postcss-scope-odontogram.cjs")]: {},
    "@tailwindcss/postcss": {},
  },
};

export default config;
