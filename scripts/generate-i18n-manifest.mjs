import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const i18nDirectory = resolve(projectRoot, "public/i18n");
const manifestPath = resolve(i18nDirectory, "languages.json");

const entries = await readdir(i18nDirectory, {
  withFileTypes: true,
});

const languageFiles = entries
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".js") &&
      !entry.name.startsWith("_"),
  )
  .map((entry) => entry.name)
  .filter((name) => /^[a-z]{2}(?:-[A-Z]{2})?\.js$/.test(name))
  .sort();

const languages = {};

for (const fileName of languageFiles) {
  const code = fileName.slice(0, -3);
  const module = await import(
    pathToFileURL(resolve(i18nDirectory, fileName)).href
  );

  const languageName = module.default?.common?.lang;

  if (!languageName) {
    throw new Error(
      `Language file "${fileName}" must define common.lang.`,
    );
  }

  languages[code] = languageName;
}

await writeFile(
  manifestPath,
  `${JSON.stringify(languages, null, 2)}\n`,
  "utf8",
);

console.log(
  `Generated ${manifestPath} with ${Object.keys(languages).length} language(s): ${Object.entries(languages)
    .map(([code, name]) => `${code}=${name}`)
    .join(", ")}`,
);
