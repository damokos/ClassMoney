const DEFAULT_LANGUAGE = "hu";
const LANGUAGE_COOKIE = "classmoney_language";
const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

let languages = {};
let translations = {};
let currentLanguage = DEFAULT_LANGUAGE;

function getCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;

  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length) || null;
}

function setCookie(name, value, maxAge) {
  document.cookie = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "SameSite=Lax",
  ].join("; ");
}

function getNestedValue(object, path) {
  return path.split(".").reduce(
    (value, key) => value?.[key],
    object,
  );
}

function interpolate(value, variables = {}) {
  return value.replace(
    /\{\{\s*([\w.-]+)\s*\}\}/g,
    (_, key) => String(getNestedValue(variables, key) ?? ""),
  );
}

export async function initI18n() {
  const response = await fetch("/i18n/languages.json", {
    cache: "no-cache",
  });

  if (!response.ok) {
    throw new Error("Failed to load available languages.");
  }

  languages = await response.json();

  const cookieLanguage = getCookie(LANGUAGE_COOKIE);

  currentLanguage =
    cookieLanguage && languages[cookieLanguage]
      ? cookieLanguage
      : DEFAULT_LANGUAGE;

  if (!languages[currentLanguage]) {
    currentLanguage = Object.keys(languages)[0] || DEFAULT_LANGUAGE;
  }

  await loadLanguage(currentLanguage);

  return {
    language: currentLanguage,
    languages: { ...languages },
  };
}

export async function loadLanguage(language) {
  if (!languages[language]) {
    throw new Error(`Language "${language}" is not available.`);
  }

  const module = await import(
    `/i18n/${language}.js`
  );

  if (!module.default) {
    throw new Error(
      `Language file "${language}.js" does not export a default translation object.`,
    );
  }

  if (!module.default.common?.lang) {
    throw new Error(
      `Language file "${language}.js" must define common.lang.`,
    );
  }

  translations = module.default;
  currentLanguage = language;

  setCookie(
    LANGUAGE_COOKIE,
    language,
    LANGUAGE_COOKIE_MAX_AGE,
  );

  document.documentElement.lang = language;

  return translations;
}

export function setLanguage(language) {
  return loadLanguage(language);
}

export function getLanguage() {
  return currentLanguage;
}

export function getLanguages() {
  return { ...languages };
}

export function t(key, variables = {}) {
  const value =
    getNestedValue(translations, key) ??
    getNestedValue(
      translations,
      `common.${key}`,
    );

  if (value === undefined || value === null) {
    return key;
  }

  if (typeof value !== "string") {
    return value;
  }

  return interpolate(value, variables);
}
