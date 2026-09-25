import {
  initI18n,
  setLanguage,
  getLanguage,
  getLanguages,
  t,
} from "./i18n/i18n.js";

import {
  getMe,
  getClasses,
  createClass,
  updateClass,
  archiveClass,
} from "./api.js";

const app = document.getElementById("app");

let currentUser = null;
let classesIncludeArchived = false;

const navigationItems = [
  {
    key: "dashboard",
    translationKey: "dashboard",
  },
  {
    key: "classes",
    translationKey: "classes",
    visible: (user) =>
      user?.roles?.some(
        (role) =>
          role.role === "ADMIN" ||
          role.role === "PARENT_REPRESENTATIVE" ||
          role.role === "TREASURER",
      ) ?? false,
  },
  {
    key: "children",
    translationKey: "children",
    visible: (user) =>
      user?.roles?.some(
        (role) =>
          role.role === "ADMIN" ||
          role.role === "PARENT_REPRESENTATIVE" ||
          role.role === "TREASURER",
      ) ?? false,
  },
  {
    key: "users",
    translationKey: "users",
    visible: (user) =>
      user?.roles?.some(
        (role) => role.role === "ADMIN",
      ) ?? false,
  },
  {
    key: "finances",
    translationKey: "finances",
    visible: (user) =>
      user?.roles?.some(
        (role) =>
          role.role === "PARENT_REPRESENTATIVE" ||
          role.role === "TREASURER",
      ) ?? false,
  },
  {
    key: "notifications",
    translationKey: "notifications",
    visible: () => true,
  },
  {
    key: "administration",
    translationKey: "administration",
    visible: (user) =>
      user?.roles?.some(
        (role) => role.role === "ADMIN",
      ) ?? false,
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

function isAdmin() {
  return (
    currentUser?.roles?.some(
      (role) => role.role === "ADMIN",
    ) ?? false
  );
}

function getVisibleNavigationItems() {
  return navigationItems.filter(
    (item) => !item.visible || item.visible(currentUser),
  );
}

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

function getCurrentView() {
  const hash = window.location.hash.replace(/^#/, "");
  const visibleNavigationItems = getVisibleNavigationItems();

  if (
    visibleNavigationItems.some(
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

  for (const item of getVisibleNavigationItems()) {
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

function createClassesTable(classes, onEdit, onArchive) {
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
    "classes.bankAccountNumber",
    "common.active",
  ];

  if (isAdmin()) {
    headers.push("common.actions");
  }

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

    row.append(
      createElement("td", {
        text: classItem.code,
      }),
      createElement("td", {
        text: classItem.displayName,
      }),
      createElement("td", {
        className: "amount",
        text: formatMoney(
          classItem.balance,
          classItem.currency,
          classItem.currencyDecimals,
        ),
      }),
      createElement("td", {
        text: classItem.currency,
      }),
      createElement("td", {
        text: classItem.timezone,
      }),
      createElement("td", {
        text: classItem.bankAccountNumber || "—",
      }),
    );

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

    row.append(statusCell);

    if (isAdmin()) {
      const actionsCell = createElement("td", {
        className: "table-actions",
      });

      const editButton = createElement("button", {
        className: "button button-secondary",
        text: t("common.edit"),
        attributes: {
          type: "button",
        },
      });

      editButton.addEventListener("click", () => {
        onEdit(classItem);
      });

      actionsCell.append(editButton);

      if (classItem.active) {
        const archiveButton = createElement("button", {
          className: "button button-danger",
          text: t("classes.archive"),
          attributes: {
            type: "button",
          },
        });

        archiveButton.addEventListener("click", () => {
          onArchive(classItem);
        });

        actionsCell.append(archiveButton);
      }

      row.append(actionsCell);
    }

    tbody.append(row);
  }

  table.append(thead, tbody);
  wrapper.append(table);

  return wrapper;
}

function createClassForm(classItem = null, onSaved = null) {
  const form = createElement("form", {
    className: "class-form",
  });

  const title = createElement("h2", {
    className: "form-title",
    text: classItem
      ? t("classes.edit")
      : t("classes.create"),
  });

  const codeGroup = createElement("div", {
    className: "form-group",
  });

  const codeLabel = createElement("label", {
    text: t("classes.code"),
    attributes: {
      for: "class-code",
    },
  });

  const codeInput = createElement("input", {
    attributes: {
      id: "class-code",
      name: "code",
      type: "text",
      required: "required",
      autocomplete: "off",
      value: classItem?.code ?? "",
    },
  });

  codeGroup.append(codeLabel, codeInput);

  const displayNameGroup = createElement("div", {
    className: "form-group",
  });

  const displayNameLabel = createElement("label", {
    text: t("classes.displayName"),
    attributes: {
      for: "class-display-name",
    },
  });

  const displayNameInput = createElement("input", {
    attributes: {
      id: "class-display-name",
      name: "displayName",
      type: "text",
      required: "required",
      autocomplete: "off",
      value: classItem?.displayName ?? "",
    },
  });

  displayNameGroup.append(
    displayNameLabel,
    displayNameInput,
  );

  const currencyGroup = createElement("div", {
    className: "form-group",
  });

  const currencyLabel = createElement("label", {
    text: t("classes.currency"),
    attributes: {
      for: "class-currency",
    },
  });

  const currencyInput = createElement("input", {
    attributes: {
      id: "class-currency",
      name: "currency",
      type: "text",
      required: "required",
      maxlength: "3",
      autocomplete: "off",
      value: classItem?.currency ?? "HUF",
    },
  });

  currencyGroup.append(
    currencyLabel,
    currencyInput,
  );

  const decimalsGroup = createElement("div", {
    className: "form-group",
  });

  const decimalsLabel = createElement("label", {
    text: "Tizedesjegyek",
    attributes: {
      for: "class-currency-decimals",
    },
  });

  const decimalsInput = createElement("input", {
    attributes: {
      id: "class-currency-decimals",
      name: "currencyDecimals",
      type: "number",
      min: "0",
      max: "3",
      step: "1",
      required: "required",
      value: String(classItem?.currencyDecimals ?? 0),
    },
  });

  decimalsGroup.append(
    decimalsLabel,
    decimalsInput,
  );

  const timezoneGroup = createElement("div", {
    className: "form-group",
  });

  const timezoneLabel = createElement("label", {
    text: t("classes.timezone"),
    attributes: {
      for: "class-timezone",
    },
  });

  const timezoneInput = createElement("input", {
    attributes: {
      id: "class-timezone",
      name: "timezone",
      type: "text",
      required: "required",
      autocomplete: "off",
      value: classItem?.timezone ?? "Europe/Budapest",
    },
  });

  timezoneGroup.append(
    timezoneLabel,
    timezoneInput,
  );

  const bankAccountGroup = createElement("div", {
    className: "form-group",
  });

  const bankAccountLabel = createElement("label", {
    text: t("classes.bankAccountNumber"),
    attributes: {
      for: "class-bank-account",
    },
  });

  const bankAccountInput = createElement("input", {
    attributes: {
      id: "class-bank-account",
      name: "bankAccountNumber",
      type: "text",
      autocomplete: "off",
      value: classItem?.bankAccountNumber ?? "",
    },
  });

  bankAccountGroup.append(
    bankAccountLabel,
    bankAccountInput,
  );

  const formActions = createElement("div", {
    className: "form-actions",
  });

  const saveButton = createElement("button", {
    className: "button button-primary",
    text: t("common.save"),
    attributes: {
      type: "submit",
    },
  });

  const cancelButton = createElement("button", {
    className: "button button-secondary",
    text: t("common.cancel"),
    attributes: {
      type: "button",
    },
  });

  cancelButton.addEventListener("click", () => {
    form.remove();
  });

  formActions.append(
    saveButton,
    cancelButton,
  );

  form.append(
    title,
    codeGroup,
    displayNameGroup,
    currencyGroup,
    decimalsGroup,
    timezoneGroup,
    bankAccountGroup,
    formActions,
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    saveButton.disabled = true;

    try {
      const payload = {
        displayName: displayNameInput.value.trim(),
        currency: currencyInput.value.trim().toUpperCase(),
        currencyDecimals: Number(decimalsInput.value),
        timezone: timezoneInput.value.trim(),
        bankAccountNumber:
          bankAccountInput.value.trim() || null,
      };

      if (!classItem) {
        await createClass({
          code: codeInput.value.trim(),
          ...payload,
        });
      } else {
        await updateClass(classItem.id, payload);
      }

      if (onSaved) {
        await onSaved();
      }
    } catch (error) {
      console.error("Failed to save class:", error);

      window.alert(
        error.message || t("messages.operationFailed"),
      );

      saveButton.disabled = false;
    }
  });

  return form;
}

async function createClassesView() {
  const section = createElement("section", {
    className: "content-view",
  });

  const header = createElement("div", {
    className: "content-view-header",
  });

  const headerContent = createElement("div");

  const title = createElement("h1", {
    className: "page-title",
    text: t("classes.title"),
  });

  const description = createElement("p", {
    className: "page-description",
    text: t("common.loading"),
  });

  headerContent.append(title, description);

  const headerActions = createElement("div", {
    className: "content-view-actions",
  });

  if (isAdmin()) {
    const createButton = createElement("button", {
      className: "button button-primary",
      text: t("classes.create"),
      attributes: {
        type: "button",
      },
    });

    createButton.addEventListener("click", () => {
      const existingForm = section.querySelector(
        ".class-form",
      );

      if (existingForm) {
        existingForm.remove();
        return;
      }

      const form = createClassForm(
        null,
        async () => {
          await render();
        },
      );

      section.insertBefore(
        form,
        content,
      );
    });

    headerActions.append(createButton);

    const archivedLabel = createElement("label", {
      className: "checkbox-label",
    });

    const archivedCheckbox = createElement("input", {
      attributes: {
        type: "checkbox",
      },
    });

    archivedCheckbox.checked = classesIncludeArchived;

    archivedCheckbox.addEventListener("change", async () => {
      classesIncludeArchived =
        archivedCheckbox.checked;

      await render();
    });

    archivedLabel.append(
      archivedCheckbox,
      createElement("span", {
        text: "Archivált osztályok",
      }),
    );

    headerActions.append(archivedLabel);
  }

  header.append(headerContent, headerActions);

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

  const reload = async () => {
    await render();
  };

  const editClass = (classItem) => {
    const existingForm = section.querySelector(
      ".class-form",
    );

    if (existingForm) {
      existingForm.remove();
    }

    const form = createClassForm(
      classItem,
      reload,
    );

    section.insertBefore(form, content);
  };

  const archiveClassItem = async (classItem) => {
    const confirmed = window.confirm(
      `${t("classes.archive")}: ${classItem.displayName}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await archiveClass(classItem.id);
      await render();
    } catch (error) {
      console.error(
        "Failed to archive class:",
        error,
      );

      window.alert(
        error.message || t("messages.operationFailed"),
      );
    }
  };

  try {
    const result = await getClasses(
      isAdmin() && classesIncludeArchived,
    );

    const classes = result?.data?.classes ?? [];

    description.textContent =
      `${classes.length}`;

    if (classes.length === 0) {
      content.replaceChildren(
        createElement("p", {
          className: "content-panel-message",
          text: t("common.noData"),
        }),
      );
    } else {
      content.replaceChildren(
        createClassesTable(
          classes,
          editClass,
          archiveClassItem,
        ),
      );
    }
  } catch (error) {
    console.error(
      "Failed to load classes:",
      error,
    );

    description.textContent =
      t("errors.network");

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
      throw new Error(
        "Authenticated user information is unavailable.",
      );
    }

    window.addEventListener(
      "hashchange",
      () => {
        render();
      },
    );

    if (!window.location.hash) {
      setView("dashboard");
      return;
    }

    await render();
  } catch (error) {
    console.error(
      "Failed to start ClassMoney:",
      error,
    );

    app.replaceChildren(
      createElement("div", {
        className: "app-error",
        text: "ClassMoney failed to start.",
      }),
    );
  }
}

startApp();
