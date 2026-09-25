import {
  initI18n,
  setLanguage,
  getLanguage,
  getLanguages,
  t,
} from "./i18n/i18n.js";

import {
  getClasses,
  getMe,
} from "./api.js";

const app = document.getElementById("app");

let currentUser = null;

const navigationItems = [
  {
    key: "dashboard",
    translationKey: "dashboard",
    roles: ["ADMIN", "PARENT_REPRESENTATIVE", "TREASURER"],
  },
  {
    key: "classes",
    translationKey: "classes",
    roles: ["ADMIN", "PARENT_REPRESENTATIVE", "TREASURER"],
  },
  {
    key: "children",
    translationKey: "children",
    roles: [
      "ADMIN",
      "PARENT_REPRESENTATIVE",
      "TREASURER",
    ],
  },
  {
    key: "users",
    translationKey: "users",
    roles: ["ADMIN"],
  },
  {
    key: "finances",
    translationKey: "finances",
    roles: [
      "PARENT_REPRESENTATIVE",
      "TREASURER",
    ],
  },
  {
    key: "notifications",
    translationKey: "notifications",
    roles: [
      "ADMIN",
      "PARENT_REPRESENTATIVE",
      "TREASURER",
    ],
  },
  {
    key: "administration",
    translationKey: "administration",
    roles: ["ADMIN"],
  },
];

const viewTranslations = {
  dashboard: {
    title: "dashboard.title",
    description: "dashboard.welcome",
  },
  classes: {
    title: "classes.title",
    description: "common.noData",
  },
  children: {
    title: "children.title",
    description: "common.noData",
  },
  users: {
    title: "users.title",
    description: "common.noData",
  },
  finances: {
    title: "financial.title",
    description: "common.noData",
  },
  notifications: {
    title: "notifications.title",
    description: "notifications.description",
  },
  administration: {
    title: "navigation.administration",
    description: "common.noData",
  },
};

function createElement(tag, options = {}) {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  if (options.attributes) {
    for (const [name, value] of Object.entries(options.attributes)) {
      element.setAttribute(name, value);
    }
  }

  return element;
}

function userHasRole(role) {
  return currentUser?.roles?.some(
    (userRole) => userRole.role === role,
  ) ?? false;
}

function canAccessNavigationItem(item) {
  if (!currentUser?.active) {
    return false;
  }

  return item.roles.some((role) => userHasRole(role));
}

function getAvailableNavigationItems() {
  return navigationItems.filter(canAccessNavigationItem);
}

function getCurrentView() {
  const hash = window.location.hash.replace(/^#/, "");
  const availableItems = getAvailableNavigationItems();

  if (
    availableItems.some(
      (item) => item.key === hash,
    )
  ) {
    return hash;
  }

  return "dashboard";
}

function setView(view) {
  window.location.hash = view;
}

function formatMoney(amount, currency, decimals) {
  return new Intl.NumberFormat(getLanguage(), {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount / 10 ** decimals);
}

function createHeader() {
  const header = createElement("header", {
    className: "app-header",
  });

  const brand = createElement("div", {
    className: "app-brand",
  });

  const brandTitle = createElement("span", {
    className: "app-brand-title",
    text: t("common.appName"),
  });

  brand.append(brandTitle);

  const headerActions = createElement("div", {
    className: "app-header-actions",
  });

  const languageLabel = createElement("span", {
    className: "language-label",
    text: t("language.selector"),
  });

  const languageSelect = createElement("select", {
    className: "language-select",
    attributes: {
      "aria-label": t("accessibility.changeLanguage"),
    },
  });

  for (const [code, name] of Object.entries(getLanguages())) {
    const option = createElement("option", {
      text: name,
      attributes: {
        value: code,
      },
    });

    option.selected = code === getLanguage();
    languageSelect.append(option);
  }

  languageSelect.addEventListener("change", async (event) => {
    await setLanguage(event.target.value);
    await render();
  });

  headerActions.append(languageLabel, languageSelect);
  header.append(brand, headerActions);

  return header;
}

function createNavigation(currentView) {
  const navigation = createElement("nav", {
    className: "app-navigation",
    attributes: {
      "aria-label": t("common.appName"),
    },
  });

  for (const item of getAvailableNavigationItems()) {
    const button = createElement("button", {
      className: "navigation-item",
      text: t(`navigation.${item.translationKey}`),
      attributes: {
        type: "button",
        "data-view": item.key,
      },
    });

    if (item.key === currentView) {
      button.classList.add("active");
      button.setAttribute("aria-current", "page");
    }

    button.addEventListener("click", () => {
      setView(item.key);
    });

    navigation.append(button);
  }

  return navigation;
}

function createDashboardView() {
  const dashboard = createElement("section", {
    className: "dashboard-view",
  });

  const dashboardHeader = createElement("div", {
    className: "dashboard-header",
  });

  const dashboardTitle = createElement("h1", {
    className: "page-title",
    text: t("dashboard.title"),
  });

  const dashboardWelcome = createElement("p", {
    className: "page-description",
    text: t("dashboard.welcome"),
  });

  dashboardHeader.append(
    dashboardTitle,
    dashboardWelcome,
  );

  const dashboardCards = createElement("div", {
    className: "dashboard-cards",
  });

  const balanceCard = createElement("article", {
    className: "dashboard-card",
  });

  const balanceTitle = createElement("h2", {
    className: "dashboard-card-title",
    text: t("dashboard.balance"),
  });

  const balanceValue = createElement("div", {
    className: "dashboard-card-value",
    text: "—",
  });

  balanceCard.append(
    balanceTitle,
    balanceValue,
  );

  const activityCard = createElement("article", {
    className: "dashboard-card dashboard-card-wide",
  });

  const activityTitle = createElement("h2", {
    className: "dashboard-card-title",
    text: t("dashboard.recentActivity"),
  });

  const activityEmpty = createElement("p", {
    className: "dashboard-card-empty",
    text: t("common.noData"),
  });

  activityCard.append(
    activityTitle,
    activityEmpty,
  );

  dashboardCards.append(
    balanceCard,
    activityCard,
  );

  dashboard.append(
    dashboardHeader,
    dashboardCards,
  );

  return dashboard;
}

function createClassesTable(classes) {
  const wrapper = createElement("div", {
    className: "table-wrapper",
  });

  const table = createElement("table", {
    className: "data-table",
  });

  const thead = createElement("thead");

  const headerRow = createElement("tr");

  const headers = [
    "classes.code",
    "classes.displayName",
    "dashboard.balance",
    "classes.currency",
    "classes.timezone",
    "common.active",
  ];

  for (const key of headers) {
    const th = createElement("th", {
      text: t(key),
    });

    headerRow.append(th);
  }

  thead.append(headerRow);

  const tbody = createElement("tbody");

  for (const classItem of classes) {
    const row = createElement("tr");

    const codeCell = createElement("td", {
      text: classItem.code,
    });

    const nameCell = createElement("td", {
      text: classItem.displayName,
    });

    const balanceCell = createElement("td", {
      className: "amount",
      text: formatMoney(
        classItem.balance,
        classItem.currency,
        classItem.currencyDecimals,
      ),
    });

    const currencyCell = createElement("td", {
      text: classItem.currency,
    });

    const timezoneCell = createElement("td", {
      text: classItem.timezone,
    });

    const statusCell = createElement("td");

    statusCell.append(
      createElement("span", {
        className: `status-badge ${
          classItem.active
            ? "status-active"
            : "status-inactive"
        }`,
        text: classItem.active
          ? t("common.active")
          : t("common.inactive"),
      }),
    );

    row.append(
      codeCell,
      nameCell,
      balanceCell,
      currencyCell,
      timezoneCell,
      statusCell,
    );

    tbody.append(row);
  }

  table.append(thead, tbody);
  wrapper.append(table);

  return wrapper;
}

async function createClassesView() {
  const section = createElement("section", {
    className: "content-view",
  });

  const header = createElement("div", {
    className: "content-view-header",
  });

  const title = createElement("h1", {
    className: "page-title",
    text: t("classes.title"),
  });

  const description = createElement("p", {
    className: "page-description",
    text: t("common.loading"),
  });

  header.append(title, description);

  const content = createElement("div", {
    className: "content-panel",
  });

  content.append(
    createElement("p", {
      className: "content-panel-message",
      text: t("common.loading"),
    }),
  );

  section.append(header, content);

  try {
    const result = await getClasses();
    const classes = result?.data?.classes ?? [];

    description.textContent = `${classes.length}`;

    if (classes.length === 0) {
      content.replaceChildren(
        createElement("p", {
          className: "content-panel-message",
          text: t("common.noData"),
        }),
      );
    } else {
      content.replaceChildren(
        createClassesTable(classes),
      );
    }
  } catch (error) {
    console.error("Failed to load classes:", error);

    description.textContent = t("errors.network");

    content.replaceChildren(
      createElement("p", {
        className: "content-panel-message error",
        text: t("messages.operationFailed"),
      }),
    );
  }

  return section;
}

function createEmptyView(view) {
  const translation = viewTranslations[view];

  const section = createElement("section", {
    className: "content-view",
  });

  const header = createElement("div", {
    className: "content-view-header",
  });

  const title = createElement("h1", {
    className: "page-title",
    text: t(translation.title),
  });

  const description = createElement("p", {
    className: "page-description",
    text: t(translation.description),
  });

  header.append(title, description);

  const emptyState = createElement("div", {
    className: "empty-state",
  });

  const emptyTitle = createElement("h2", {
    className: "empty-state-title",
    text: t(translation.title),
  });

  const emptyDescription = createElement("p", {
    className: "empty-state-description",
    text: t("common.noData"),
  });

  emptyState.append(
    emptyTitle,
    emptyDescription,
  );

  section.append(header, emptyState);

  return section;
}

async function createMain(currentView) {
  const main = createElement("main", {
    className: "app-main",
  });

  if (currentView === "dashboard") {
    main.append(createDashboardView());
  } else if (currentView === "classes") {
    main.append(await createClassesView());
  } else {
    main.append(createEmptyView(currentView));
  }

  return main;
}

async function render() {
  const currentView = getCurrentView();

  app.replaceChildren();

  const shell = createElement("div", {
    className: "app-shell",
  });

  const header = createHeader();

  const layout = createElement("div", {
    className: "app-layout",
  });

  const navigation = createNavigation(currentView);
  const main = await createMain(currentView);

  layout.append(navigation, main);
  shell.append(header, layout);
  app.append(shell);
}

async function startApp() {
  try {
    await initI18n();

    const me = await getMe();
    currentUser = me?.data?.user ?? null;

    if (!currentUser) {
      throw new Error("Authenticated user information is missing.");
    }

    window.addEventListener("hashchange", () => {
      render();
    });

    if (!window.location.hash) {
      setView("dashboard");
      return;
    }

    await render();
  } catch (error) {
    console.error("Failed to start ClassMoney:", error);

    app.replaceChildren(
      createElement("div", {
        className: "app-error",
        text: "ClassMoney failed to start.",
      }),
    );
  }
}

startApp();
