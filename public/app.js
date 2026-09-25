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
  getChildren,
  createChild,
  updateChild,
  getFinances,
  createCharge,
  payCharge,
  cancelCharge,
  createExpense,
  payExpense,
  cancelExpense,
  createFinancialTransaction,
  payFinancialTransaction,
  cancelFinancialTransaction,
} from "./api.js";

const app = document.getElementById("app");

let currentUser = null;
let classesIncludeArchived = false;
let childrenClassId = null;
let childrenIncludeInactive = false;
let financesClassId = null;
let financesIncludeCancelled = false;

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
          role.role === "ADMIN" ||
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
    for (const [name, value] of Object.entries(
      options.attributes,
    )) {
      element.setAttribute(name, value);
    }
  }

  return element;
}

function getCurrentView() {
  const hash = window.location.hash.replace(/^#/, "");
  const visibleNavigationItems =
    getVisibleNavigationItems();

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

  for (const [code, name] of Object.entries(
    getLanguages(),
  )) {
    const option = createElement("option", {
      text: name,
      attributes: {
        value: code,
      },
    });

    option.selected = code === getLanguage();
    languageSelect.append(option);
  }

  languageSelect.addEventListener(
    "change",
    async (event) => {
      await setLanguage(event.target.value);
      await render();
    },
  );

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

function createClassesTable(
  classes,
  onEdit,
  onArchive,
) {
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
        const archiveButton = createElement(
          "button",
          {
            className: "button button-danger",
            text: t("classes.archive"),
            attributes: {
              type: "button",
            },
          },
        );

        archiveButton.addEventListener(
          "click",
          () => {
            onArchive(classItem);
          },
        );

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

function createClassForm(
  classItem = null,
  onSaved = null,
) {
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
      value: String(
        classItem?.currencyDecimals ?? 0,
      ),
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
      value:
        classItem?.timezone ??
        "Europe/Budapest",
    },
  });

  timezoneGroup.append(
    timezoneLabel,
    timezoneInput,
  );

  const bankAccountGroup = createElement(
    "div",
    {
      className: "form-group",
    },
  );

  const bankAccountLabel = createElement(
    "label",
    {
      text: t("classes.bankAccountNumber"),
      attributes: {
        for: "class-bank-account",
      },
    },
  );

  const bankAccountInput = createElement(
    "input",
    {
      attributes: {
        id: "class-bank-account",
        name: "bankAccountNumber",
        type: "text",
        autocomplete: "off",
        value:
          classItem?.bankAccountNumber ?? "",
      },
    },
  );

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

  const cancelButton = createElement(
    "button",
    {
      className: "button button-secondary",
      text: t("common.cancel"),
      attributes: {
        type: "button",
      },
    },
  );

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

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      saveButton.disabled = true;

      try {
        const payload = {
          displayName:
            displayNameInput.value.trim(),
          currency:
            currencyInput.value
              .trim()
              .toUpperCase(),
          currencyDecimals:
            Number(decimalsInput.value),
          timezone:
            timezoneInput.value.trim(),
          bankAccountNumber:
            bankAccountInput.value.trim() ||
            null,
        };

        if (!classItem) {
          await createClass({
            code: codeInput.value.trim(),
            ...payload,
          });
        } else {
          await updateClass(
            classItem.id,
            payload,
          );
        }

        if (onSaved) {
          await onSaved();
        }
      } catch (error) {
        console.error(
          "Failed to save class:",
          error,
        );

        window.alert(
          error.message ||
            t("messages.operationFailed"),
        );

        saveButton.disabled = false;
      }
    },
  );

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
    const createButton = createElement(
      "button",
      {
        className: "button button-primary",
        text: t("classes.create"),
        attributes: {
          type: "button",
        },
      },
    );

    createButton.addEventListener(
      "click",
      () => {
        const existingForm =
          section.querySelector(
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
      },
    );

    headerActions.append(createButton);

    const archivedLabel = createElement(
      "label",
      {
        className: "checkbox-label",
      },
    );

    const archivedCheckbox =
      createElement("input", {
        attributes: {
          type: "checkbox",
        },
      });

    archivedCheckbox.checked =
      classesIncludeArchived;

    archivedCheckbox.addEventListener(
      "change",
      async () => {
        classesIncludeArchived =
          archivedCheckbox.checked;

        await render();
      },
    );

    archivedLabel.append(
      archivedCheckbox,
      createElement("span", {
        text: "Archivált osztályok",
      }),
    );

    headerActions.append(
      archivedLabel,
    );
  }

  header.append(
    headerContent,
    headerActions,
  );

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
    const existingForm =
      section.querySelector(
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

  const archiveClassItem = async (
    classItem,
  ) => {
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
        error.message ||
          t("messages.operationFailed"),
      );
    }
  };

  try {
    const result = await getClasses(
      isAdmin() &&
        classesIncludeArchived,
    );

    const classes =
      result?.data?.classes ?? [];

    description.textContent =
      `${classes.length}`;

    if (classes.length === 0) {
      content.replaceChildren(
        createElement("p", {
          className:
            "content-panel-message",
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
        className:
          "content-panel-message error",
        text: t(
          "messages.operationFailed",
        ),
      }),
    );
  }

  return section;
}

function createChildrenTable(
  children,
  onEdit,
  onToggleActive,
) {
  const wrapper = createElement("div", {
    className: "table-wrapper",
  });

  const table = createElement("table", {
    className: "data-table",
  });

  const thead = createElement("thead");
  const headerRow = createElement("tr");

  const headers = [
    "children.name",
    "common.active",
    "common.actions",
  ];

  for (const key of headers) {
    const th = createElement("th", {
      text: t(key),
    });

    headerRow.append(th);
  }

  thead.append(headerRow);

  const tbody = createElement("tbody");

  for (const child of children) {
    const row = createElement("tr");

    row.append(
      createElement("td", {
        text: child.name,
      }),
    );

    const statusCell = createElement("td");

    statusCell.append(
      createElement("span", {
        className: `status-badge ${
          child.active
            ? "status-active"
            : "status-inactive"
        }`,
        text: child.active
          ? t("common.active")
          : t("common.inactive"),
      }),
    );

    row.append(statusCell);

    const actionsCell = createElement(
      "td",
      {
        className: "table-actions",
      },
    );

    const editButton = createElement(
      "button",
      {
        className:
          "button button-secondary",
        text: t("common.edit"),
        attributes: {
          type: "button",
        },
      },
    );

    editButton.addEventListener(
      "click",
      () => {
        onEdit(child);
      },
    );

    actionsCell.append(editButton);

    if (isAdmin()) {
      const toggleButton = createElement(
        "button",
        {
          className: child.active
            ? "button button-danger"
            : "button button-secondary",
          text: child.active
            ? t("children.deactivate")
            : t("children.activate"),
          attributes: {
            type: "button",
          },
        },
      );

      toggleButton.addEventListener(
        "click",
        () => {
          onToggleActive(child);
        },
      );

      actionsCell.append(toggleButton);
    }

    row.append(actionsCell);
    tbody.append(row);
  }

  table.append(thead, tbody);
  wrapper.append(table);

  return wrapper;
}

function createChildForm(
  classId,
  child = null,
  onSaved = null,
) {
  const form = createElement("form", {
    className:
      "child-form class-form",
  });

  const title = createElement("h2", {
    className: "form-title",
    text: child
      ? t("children.edit")
      : t("children.create"),
  });

  const nameGroup = createElement(
    "div",
    {
      className: "form-group",
    },
  );

  const nameLabel = createElement(
    "label",
    {
      text: t("children.name"),
      attributes: {
        for: "child-name",
      },
    },
  );

  const nameInput = createElement(
    "input",
    {
      attributes: {
        id: "child-name",
        name: "name",
        type: "text",
        required: "required",
        autocomplete: "off",
        value: child?.name ?? "",
      },
    },
  );

  nameGroup.append(
    nameLabel,
    nameInput,
  );

  const formActions = createElement(
    "div",
    {
      className: "form-actions",
    },
  );

  const saveButton = createElement(
    "button",
    {
      className:
        "button button-primary",
      text: t("common.save"),
      attributes: {
        type: "submit",
      },
    },
  );

  const cancelButton = createElement(
    "button",
    {
      className:
        "button button-secondary",
      text: t("common.cancel"),
      attributes: {
        type: "button",
      },
    },
  );

  cancelButton.addEventListener(
    "click",
    () => {
      form.remove();
    },
  );

  formActions.append(
    saveButton,
    cancelButton,
  );

  form.append(
    title,
    nameGroup,
    formActions,
  );

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      saveButton.disabled = true;

      try {
        if (!child) {
          await createChild(classId, {
            name: nameInput.value.trim(),
          });
        } else {
          await updateChild(
            classId,
            child.id,
            {
              name: nameInput.value.trim(),
            },
          );
        }

        if (onSaved) {
          await onSaved();
        }
      } catch (error) {
        console.error(
          "Failed to save child:",
          error,
        );

        window.alert(
          error.message ||
            t(
              "messages.operationFailed",
            ),
        );

        saveButton.disabled = false;
      }
    },
  );

  return form;
}

async function createChildrenView() {
  const section = createElement("section", {
    className: "content-view",
  });

  const header = createElement("div", {
    className:
      "content-view-header",
  });

  const headerContent =
    createElement("div");

  const title = createElement("h1", {
    className: "page-title",
    text: t("children.title"),
  });

  const description = createElement(
    "p",
    {
      className: "page-description",
      text: t("common.loading"),
    },
  );

  headerContent.append(
    title,
    description,
  );

  const headerActions = createElement(
    "div",
    {
      className:
        "content-view-actions",
    },
  );

  const classSelectLabel =
    createElement("label", {
      className:
        "form-inline-label",
      text: t("classes.title"),
    });

  const classSelect = createElement(
    "select",
    {
      className: "form-select",
      attributes: {
        "aria-label":
          t("classes.title"),
      },
    },
  );

  headerActions.append(
    classSelectLabel,
    classSelect,
  );

  if (isAdmin()) {
    const inactiveLabel =
      createElement("label", {
        className:
          "checkbox-label",
      });

    const inactiveCheckbox =
      createElement("input", {
        attributes: {
          type: "checkbox",
        },
      });

    inactiveCheckbox.checked =
      childrenIncludeInactive;

    inactiveCheckbox.addEventListener(
      "change",
      async () => {
        childrenIncludeInactive =
          inactiveCheckbox.checked;

        await loadChildren();
      },
    );

    inactiveLabel.append(
      inactiveCheckbox,
      createElement("span", {
        text: t(
          "children.includeInactive",
        ),
      }),
    );

    headerActions.append(
      inactiveLabel,
    );
  }

  const createButton = createElement(
    "button",
    {
      className:
        "button button-primary",
      text: t("children.create"),
      attributes: {
        type: "button",
      },
    },
  );

  headerActions.append(
    createButton,
  );

  header.append(
    headerContent,
    headerActions,
  );

  const content = createElement("div", {
    className: "content-panel",
  });

  content.append(
    createElement("p", {
      className:
        "content-panel-message",
      text: t("common.loading"),
    }),
  );

  section.append(
    header,
    content,
  );

  const reload = async () => {
    await loadChildren();
  };

  const editChild = (child) => {
    const existingForm =
      section.querySelector(
        ".child-form",
      );

    if (existingForm) {
      existingForm.remove();
    }

    const form = createChildForm(
      childrenClassId,
      child,
      reload,
    );

    section.insertBefore(
      form,
      content,
    );
  };

  const toggleChildActive =
    async (child) => {
      const action = child.active
        ? t(
            "children.deactivate",
          )
        : t(
            "children.activate",
          );

      const confirmed =
        window.confirm(
          `${action}: ${child.name}?`,
        );

      if (!confirmed) {
        return;
      }

      try {
        await updateChild(
          childrenClassId,
          child.id,
          {
            active: !child.active,
          },
        );

        await loadChildren();
      } catch (error) {
        console.error(
          "Failed to change child status:",
          error,
        );

        window.alert(
          error.message ||
            t(
              "messages.operationFailed",
            ),
        );
      }
    };

  const loadChildren =
    async () => {
      if (!childrenClassId) {
        content.replaceChildren(
          createElement("p", {
            className:
              "content-panel-message",
            text: t(
              "common.noData",
            ),
          }),
        );

        return;
      }

      try {
        const result =
          await getChildren(
            childrenClassId,
            isAdmin() &&
              childrenIncludeInactive,
          );

        const children =
          result?.data?.children ??
          [];

        description.textContent =
          `${children.length}`;

        if (children.length === 0) {
          content.replaceChildren(
            createElement("p", {
              className:
                "content-panel-message",
              text: t(
                "common.noData",
              ),
            }),
          );

          return;
        }

        content.replaceChildren(
          createChildrenTable(
            children,
            editChild,
            toggleChildActive,
          ),
        );
      } catch (error) {
        console.error(
          "Failed to load children:",
          error,
        );

        description.textContent =
          t("errors.network");

        content.replaceChildren(
          createElement("p", {
            className:
              "content-panel-message error",
            text: t(
              "messages.operationFailed",
            ),
          }),
        );
      }
    };

  try {
    const result =
      await getClasses(false);

    const classes =
      result?.data?.classes ?? [];

    classSelect.replaceChildren();

    for (const classItem of classes) {
      const option = createElement(
        "option",
        {
          text: `${classItem.code} – ${classItem.displayName}`,
          attributes: {
            value: String(
              classItem.id,
            ),
          },
        },
      );

      classSelect.append(
        option,
      );
    }

    if (classes.length === 0) {
      classSelect.disabled =
        true;
      createButton.disabled =
        true;

      description.textContent =
        t("common.noData");

      content.replaceChildren(
        createElement("p", {
          className:
            "content-panel-message",
          text: t(
            "common.noData",
          ),
        }),
      );

      return section;
    }

    const selectedClassExists =
      classes.some(
        (classItem) =>
          classItem.id ===
          childrenClassId,
      );

    if (!selectedClassExists) {
      childrenClassId =
        classes[0].id;
    }

    classSelect.value =
      String(childrenClassId);

    classSelect.addEventListener(
      "change",
      async () => {
        childrenClassId =
          Number(
            classSelect.value,
          );

        const existingForm =
          section.querySelector(
            ".child-form",
          );

        if (existingForm) {
          existingForm.remove();
        }

        await loadChildren();
      },
    );

    createButton.addEventListener(
      "click",
      () => {
        const existingForm =
          section.querySelector(
            ".child-form",
          );

        if (existingForm) {
          existingForm.remove();
          return;
        }

        const form =
          createChildForm(
            childrenClassId,
            null,
            reload,
          );

        section.insertBefore(
          form,
          content,
        );
      },
    );

    await loadChildren();
  } catch (error) {
    console.error(
      "Failed to load classes for children:",
      error,
    );

    classSelect.disabled =
      true;
    createButton.disabled =
      true;

    description.textContent =
      t("errors.network");

    content.replaceChildren(
      createElement("p", {
        className:
          "content-panel-message error",
        text: t(
          "messages.operationFailed",
        ),
      }),
    );
  }

  return section;
}

function createFinanceSectionTitle(
  titleKey,
  count,
  actionButton = null,
) {
  const wrapper = createElement("div", {
    className: "finance-section-header",
  });

  const heading = createElement("div", {
    className: "finance-section-heading",
  });

  heading.append(
    createElement("h2", {
      className: "section-title",
      text: t(titleKey),
    }),
    createElement("span", {
      className: "section-count",
      text: String(count),
    }),
  );

  wrapper.append(heading);

  if (actionButton) {
    wrapper.append(actionButton);
  }

  return wrapper;
}

function createFinanceTable(
  columns,
  rows,
  emptyText,
) {
  if (rows.length === 0) {
    return createElement("p", {
      className:
        "content-panel-message",
      text: emptyText,
    });
  }

  const wrapper = createElement("div", {
    className: "table-wrapper",
  });

  const table = createElement("table", {
    className: "data-table",
  });

  const thead = createElement("thead");
  const headerRow = createElement("tr");

  for (const column of columns) {
    headerRow.append(
      createElement("th", {
        text: t(column.label),
      }),
    );
  }

  thead.append(headerRow);

  const tbody = createElement("tbody");

  for (const row of rows) {
    const tr = createElement("tr");

    for (const column of columns) {
      const cell = createElement("td", {
        className:
          column.className ?? "",
      });

      const rendered = column.render(row);

      if (rendered instanceof Node) {
        cell.append(rendered);
      } else {
        cell.textContent = rendered;
      }

      tr.append(cell);
    }

    tbody.append(tr);
  }

  table.append(thead, tbody);
  wrapper.append(table);

  return wrapper;
}

function getFinancialStatusTranslationKey(
  status,
) {
  return {
    PENDING: "financial.statusLabels.pending",
    PAID: "financial.statusLabels.paid",
    CANCELLED:
      "financial.statusLabels.cancelled",
    UNPAID: "financial.statusLabels.unpaid",
  }[status];
}

function createFinanceStatusBadge(
  status,
) {
  const translationKey =
    getFinancialStatusTranslationKey(
      status,
    );

  return createElement("span", {
    className: `status-badge status-${status.toLowerCase()}`,
    text: translationKey
      ? t(translationKey)
      : status,
  });
}

function hasClassRole(classId, roleName) {
  return (
    currentUser?.roles?.some(
      (role) =>
        role.role === roleName &&
        Number(role.classId) === Number(classId),
    ) ?? false
  );
}

function canOperateClassFinances(classId) {
  return (
    hasClassRole(
      classId,
      "PARENT_REPRESENTATIVE",
    ) ||
    hasClassRole(classId, "TREASURER")
  );
}

function canPayClassFinances(classId) {
  return hasClassRole(classId, "TREASURER");
}

function parseMoneyInput(value, decimals) {
  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    return null;
  }

  const multiplier = 10 ** decimals;
  const amount = Math.round(number * multiplier);

  if (amount <= 0) {
    return null;
  }

  return amount;
}

function createFinanceField(
  labelKey,
  input,
) {
  const group = createElement("div", {
    className: "form-group",
  });

  const label = createElement("label", {
    text: t(labelKey),
  });

  group.append(label, input);
  return group;
}

function createFinanceFormShell(
  titleKey,
  onSubmit,
  onCancel,
) {
  const form = createElement("form", {
    className: "class-form finance-form",
  });

  const title = createElement("h2", {
    className: "form-title",
    text: t(titleKey),
  });

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

  cancelButton.addEventListener(
    "click",
    onCancel,
  );

  formActions.append(
    saveButton,
    cancelButton,
  );

  form.append(title, formActions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    saveButton.disabled = true;
    cancelButton.disabled = true;

    try {
      await onSubmit();
    } catch (error) {
      console.error(
        "Failed to save financial item:",
        error,
      );

      window.alert(
        error.message ||
          t("messages.operationFailed"),
      );

      saveButton.disabled = false;
      cancelButton.disabled = false;
    }
  });

  return {
    form,
    saveButton,
  };
}

function createChargeForm(
  classId,
  children,
  onSaved,
  onCancel,
) {
  const childSelect = createElement("select", {
    className: "form-select",
    attributes: {
      required: "required",
    },
  });

  childSelect.append(
    createElement("option", {
      text: `${t("charges.allChildren")} (${children.length})`,
      attributes: {
        value: "all",
      },
    }),
  );

  for (const child of children) {
    childSelect.append(
      createElement("option", {
        text: child.name,
        attributes: {
          value: String(child.id),
        },
      }),
    );
  }

  const titleInput = createElement("input", {
    attributes: {
      type: "text",
      required: "required",
      autocomplete: "off",
    },
  });

  const amountInput = createElement("input", {
    attributes: {
      type: "number",
      required: "required",
      min: "0.01",
      step: "0.01",
      inputmode: "decimal",
    },
  });

  const dueDateInput = createElement("input", {
    attributes: {
      type: "date",
      required: "required",
    },
  });

  const { form } = createFinanceFormShell(
    "financial.createCharge",
    async () => {
      const classItem = await getClassForFinanceForm(
        classId,
      );

      const amount = parseMoneyInput(
        amountInput.value,
        classItem.currencyDecimals,
      );

      if (amount === null) {
        throw new Error(
          t("errors.validation"),
        );
      }

      const selectedChildId =
        childSelect.value;

      const targetChildren =
        selectedChildId === "all"
          ? children
          : children.filter(
              (child) =>
                String(child.id) ===
                selectedChildId,
            );

      if (targetChildren.length === 0) {
        throw new Error(
          t("errors.validation"),
        );
      }

      for (const child of targetChildren) {
        await createCharge(classId, {
          childId: child.id,
          title: titleInput.value.trim(),
          amount,
          dueDate: dueDateInput.value,
        });
      }

      await onSaved();
    },
    onCancel,
  );

  form.insertBefore(
    createFinanceField(
      "children.title",
      childSelect,
    ),
    form.children[1],
  );

  form.insertBefore(
    createFinanceField(
      "financial.titleLabel",
      titleInput,
    ),
    form.children[2],
  );

  form.insertBefore(
    createFinanceField(
      "financial.amount",
      amountInput,
    ),
    form.children[3],
  );

  form.insertBefore(
    createFinanceField(
      "financial.dueDate",
      dueDateInput,
    ),
    form.children[4],
  );

  return form;
}

function createExpenseForm(
  classId,
  classItem,
  onSaved,
  onCancel,
) {
  const dateInput = createElement("input", {
    attributes: {
      type: "date",
      required: "required",
      value: new Date()
        .toISOString()
        .slice(0, 10),
    },
  });

  const titleInput = createElement("input", {
    attributes: {
      type: "text",
      required: "required",
      autocomplete: "off",
    },
  });

  const categoryInput = createElement("input", {
    attributes: {
      type: "text",
      required: "required",
      autocomplete: "off",
    },
  });

  const amountInput = createElement("input", {
    attributes: {
      type: "number",
      required: "required",
      min: "0.01",
      step: "0.01",
      inputmode: "decimal",
    },
  });

  const { form } = createFinanceFormShell(
    "financial.createExpense",
    async () => {
      const amount = parseMoneyInput(
        amountInput.value,
        classItem.currencyDecimals,
      );

      if (amount === null) {
        throw new Error(
          t("errors.validation"),
        );
      }

      await createExpense(classId, {
        expenseDate: dateInput.value,
        title: titleInput.value.trim(),
        category: categoryInput.value.trim(),
        amount,
        receiptKey: null,
        receiptMimeType: null,
      });

      await onSaved();
    },
    onCancel,
  );

  form.insertBefore(
    createFinanceField(
      "financial.expenseDate",
      dateInput,
    ),
    form.children[1],
  );

  form.insertBefore(
    createFinanceField(
      "financial.titleLabel",
      titleInput,
    ),
    form.children[2],
  );

  form.insertBefore(
    createFinanceField(
      "financial.category",
      categoryInput,
    ),
    form.children[3],
  );

  form.insertBefore(
    createFinanceField(
      "financial.amount",
      amountInput,
    ),
    form.children[4],
  );

  return form;
}

function createFinancialTransactionForm(
  classId,
  classItem,
  onSaved,
  onCancel,
) {
  const categorySelect = createElement("select", {
    className: "form-select",
    attributes: {
      required: "required",
    },
  });

  const categories = [
    {
      id: 1,
      code: "OTHER",
      nameKey: "financial.categories.other",
      allowsSignedAmount: false,
    },
    {
      id: 2,
      code: "FINANCIAL_ADJUSTMENT",
      nameKey:
        "financial.categories.financialAdjustment",
      allowsSignedAmount: true,
    },
  ];

  for (const category of categories) {
    categorySelect.append(
      createElement("option", {
        text: t(category.nameKey),
        attributes: {
          value: String(category.id),
        },
      }),
    );
  }

  const descriptionInput = createElement("input", {
    attributes: {
      type: "text",
      required: "required",
      autocomplete: "off",
    },
  });

  const amountInput = createElement("input", {
    attributes: {
      type: "number",
      required: "required",
      step: "0.01",
      inputmode: "decimal",
    },
  });

  const updateAmountConstraints = () => {
    const category = categories.find(
      (item) =>
        item.id === Number(categorySelect.value),
    );

    if (category?.allowsSignedAmount) {
      amountInput.min =
        `-${10 ** -classItem.currencyDecimals}`;
    } else {
      amountInput.min = "0.01";
    }
  };

  categorySelect.addEventListener(
    "change",
    updateAmountConstraints,
  );

  updateAmountConstraints();

  const { form } = createFinanceFormShell(
    "financial.create",
    async () => {
      const category = categories.find(
        (item) =>
          item.id === Number(categorySelect.value),
      );

      const rawAmount = String(amountInput.value)
        .trim()
        .replace(/\s/g, "")
        .replace(",", ".");

      const number = Number(rawAmount);

      if (
        !Number.isFinite(number) ||
        number === 0 ||
        (!category?.allowsSignedAmount &&
          number <= 0)
      ) {
        throw new Error(
          t("errors.validation"),
        );
      }

      const amount = Math.round(
        number *
          10 ** classItem.currencyDecimals,
      );

      if (amount === 0) {
        throw new Error(
          t("errors.validation"),
        );
      }

      await createFinancialTransaction(
        classId,
        {
          categoryId: Number(
            categorySelect.value,
          ),
          description:
            descriptionInput.value.trim(),
          amount,
          receiptKey: null,
          receiptMimeType: null,
        },
      );

      await onSaved();
    },
    onCancel,
  );

  form.insertBefore(
    createFinanceField(
      "financial.category",
      categorySelect,
    ),
    form.children[1],
  );

  form.insertBefore(
    createFinanceField(
      "financial.description",
      descriptionInput,
    ),
    form.children[2],
  );

  form.insertBefore(
    createFinanceField(
      "financial.amount",
      amountInput,
    ),
    form.children[3],
  );

  return form;
}

async function getClassForFinanceForm(classId) {
  const result = await getClasses(false);
  const classItem =
    result?.data?.classes?.find(
      (item) => Number(item.id) === Number(classId),
    );

  if (!classItem) {
    throw new Error(t("errors.notFound"));
  }

  return classItem;
}

function createFinanceActionButton(
  labelKey,
  onClick,
  className = "button button-primary",
) {
  const button = createElement("button", {
    className,
    text: t(labelKey),
    attributes: {
      type: "button",
    },
  });

  button.addEventListener("click", onClick);
  return button;
}

function createFinanceRowActions(
  item,
  type,
  canOperate,
  canPay,
  onReload,
) {
  const actions = createElement("div", {
    className: "table-actions",
  });

  if (
    canPay &&
    (item.status === "PENDING" ||
      item.status === "UNPAID")
  ) {
    actions.append(
      createFinanceActionButton(
        "financial.markPaid",
        async () => {
          if (!window.confirm(t("financial.confirmMarkPaid"))) {
            return;
          }

          try {
            if (type === "charge") {
              await payCharge(item.id);
            } else if (type === "expense") {
              await payExpense(item.id);
            } else {
              await payFinancialTransaction(item.id);
            }

            await onReload();
          } catch (error) {
            console.error(
              "Failed to mark financial item paid:",
              error,
            );
            window.alert(
              error.message ||
                t("messages.operationFailed"),
            );
          }
        },
      ),
    );
  }

  if (
    canOperate &&
    (item.status === "PENDING" ||
      item.status === "UNPAID")
  ) {
    actions.append(
      createFinanceActionButton(
        "financial.cancel",
        async () => {
          if (!window.confirm(t("financial.confirmCancel"))) {
            return;
          }

          try {
              if (type === "charge") {
                await cancelCharge(item.id);
              } else if (type === "expense") {
                await cancelExpense(item.id);
              } else if (type === "financialTransaction") {
                await cancelFinancialTransaction(
                  item.id,
                );
              }
                await onReload();
          } catch (error) {
            console.error(
              "Failed to cancel financial item:",
              error,
            );
            window.alert(
              error.message ||
                t("messages.operationFailed"),
            );
          }
        },
        "button button-danger",
      ),
    );
  }

  return actions.childNodes.length > 0
    ? actions
    : "—";
}

async function createFinancesView() {
  const section = createElement("section", {
    className: "content-view",
  });

  const header = createElement("div", {
    className:
      "content-view-header",
  });

  const headerContent =
    createElement("div");

  const title = createElement("h1", {
    className: "page-title",
    text: t("financial.title"),
  });

  const description = createElement(
    "p",
    {
      className: "page-description",
      text: t("common.loading"),
    },
  );

  headerContent.append(
    title,
    description,
  );

  const headerActions = createElement(
    "div",
    {
      className:
        "content-view-actions",
    },
  );

  const classSelectLabel =
    createElement("label", {
      className:
        "form-inline-label",
      text: t("classes.title"),
    });

  const classSelect = createElement(
    "select",
    {
      className: "form-select",
      attributes: {
        "aria-label":
          t("classes.title"),
      },
    },
  );

  const cancelledLabel =
    createElement("label", {
      className:
        "checkbox-label",
    });

  const cancelledCheckbox =
    createElement("input", {
      attributes: {
        type: "checkbox",
      },
    });

  cancelledCheckbox.checked =
    financesIncludeCancelled;

  cancelledLabel.append(
    cancelledCheckbox,
    createElement("span", {
      text: t(
        "financial.includeCancelled",
      ),
    }),
  );

  headerActions.append(
    classSelectLabel,
    classSelect,
    cancelledLabel,
  );

  header.append(
    headerContent,
    headerActions,
  );

  const content = createElement("div", {
    className: "content-panel",
  });

  content.append(
    createElement("p", {
      className:
        "content-panel-message",
      text: t("common.loading"),
    }),
  );

  section.append(
    header,
    content,
  );

  let currentClass = null;
  let currentChildren = [];
  let chargeSearchQuery = "";

  const showForm = (form) => {
    const existingForm =
      section.querySelector(".finance-form");

    if (existingForm) {
      existingForm.remove();
    }

    section.insertBefore(form, content);
    form.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const loadFinances =
    async () => {
      if (!financesClassId) {
        content.replaceChildren(
          createElement("p", {
            className:
              "content-panel-message",
            text: t(
              "common.noData",
            ),
          }),
        );

        return;
      }

      try {
        const result =
          await getFinances(
            financesClassId,
            financesIncludeCancelled,
          );

        const data =
          result?.data;

        if (!data?.class) {
          throw new Error(
            "Financial data is unavailable.",
          );
        }

        currentClass = data.class;

        const childrenResult =
          await getChildren(
            financesClassId,
            false,
          );

        currentChildren =
          childrenResult?.data?.children ?? [];

        const charges =
          data.charges ?? [];

        const expenses =
          data.expenses ?? [];

        const financialTransactions =
          data.financialTransactions ??
          [];

        description.textContent =
          `${currentClass.code} – ${currentClass.displayName}`;

        const balanceCard =
          createElement("article", {
            className:
              "dashboard-card",
          });

        balanceCard.append(
          createElement("h2", {
            className:
              "dashboard-card-title",
            text: t(
              "dashboard.balance",
            ),
          }),
          createElement("div", {
            className:
              "dashboard-card-value",
            text: formatMoney(
              currentClass.balance,
              currentClass.currency,
              currentClass.currencyDecimals,
            ),
          }),
        );

        const summary =
          createElement("div", {
            className:
              "dashboard-cards",
          });

        summary.append(balanceCard);

        const canOperate =
          canOperateClassFinances(
            financesClassId,
          );
        const canPay =
          canPayClassFinances(
            financesClassId,
          );

        const createChargeButton =
          canOperate && currentChildren.length > 0
            ? createFinanceActionButton(
                "financial.createCharge",
                () => {
                  showForm(
                    createChargeForm(
                      financesClassId,
                      currentChildren,
                      async () => {
                        await loadFinances();
                        section
                          .querySelector(
                            ".finance-form",
                          )
                          ?.remove();
                      },
                      () => {
                        section
                          .querySelector(
                            ".finance-form",
                          )
                          ?.remove();
                      },
                    ),
                  );
                },
              )
            : null;

        const createExpenseButton =
          canOperate
            ? createFinanceActionButton(
                "financial.createExpense",
                () => {
                  showForm(
                    createExpenseForm(
                      financesClassId,
                      currentClass,
                      async () => {
                        await loadFinances();
                        section
                          .querySelector(
                            ".finance-form",
                          )
                          ?.remove();
                      },
                      () => {
                        section
                          .querySelector(
                            ".finance-form",
                          )
                          ?.remove();
                      },
                    ),
                  );
                },
              )
            : null;

        const createTransactionButton =
          canPay
            ? createFinanceActionButton(
                "financial.create",
                () => {
                  showForm(
                    createFinancialTransactionForm(
                      financesClassId,
                      currentClass,
                      async () => {
                        await loadFinances();
                        section
                          .querySelector(
                            ".finance-form",
                          )
                          ?.remove();
                      },
                      () => {
                        section
                          .querySelector(
                            ".finance-form",
                          )
                          ?.remove();
                      },
                    ),
                  );
                },
              )
            : null;

        const chargesSection =
          createElement("section", {
            className:
              "finance-section",
          });

        const childrenById = new Map(
          currentChildren.map((child) => [
            child.id,
            child.name,
          ]),
        );

        const normalizeChargeSearchText = (
          value,
        ) =>
          String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase(
              getLanguage(),
            );

        const sortedCharges = [
          ...charges,
        ].sort((a, b) => {
          const childA =
            childrenById.get(a.childId) ?? "";
          const childB =
            childrenById.get(b.childId) ?? "";

          const childCompare =
            normalizeChargeSearchText(
              childA,
            ).localeCompare(
              normalizeChargeSearchText(
                childB,
              ),
              getLanguage(),
            );

          if (childCompare !== 0) {
            return childCompare;
          }

          return normalizeChargeSearchText(
            a.title,
          ).localeCompare(
            normalizeChargeSearchText(
              b.title,
            ),
            getLanguage(),
          );
        });

        const chargeSearchGroup =
          createElement("div", {
            className: "form-group",
          });

        const chargeSearchLabel =
          createElement("label", {
            text: t("charges.search"),
            attributes: {
              for: "charges-search",
            },
          });

        const chargeSearchInput =
          createElement("input", {
            attributes: {
              id: "charges-search",
              type: "search",
              autocomplete: "off",
              placeholder: t(
                "charges.searchPlaceholder",
              ),
              value: chargeSearchQuery,
            },
          });

        chargeSearchGroup.append(
          chargeSearchLabel,
          chargeSearchInput,
        );

        const chargesTableContainer =
          createElement("div");

        const renderChargesTable = () => {
          const query =
            normalizeChargeSearchText(
              chargeSearchInput.value,
            );

          const visibleCharges =
            query
              ? sortedCharges.filter(
                  (charge) => {
                    const childName =
                      childrenById.get(
                        charge.childId,
                      ) ?? "";

                    return (
                      normalizeChargeSearchText(
                        childName,
                      ).includes(query) ||
                      normalizeChargeSearchText(
                        charge.title,
                      ).includes(query)
                    );
                  },
                )
              : sortedCharges;

          chargesTableContainer.replaceChildren(
            createFinanceTable(
              [
                {
                  label:
                    "charges.child",
                  render: (item) =>
                    childrenById.get(
                      item.childId,
                    ) ?? "—",
                },
                {
                  label:
                    "financial.titleLabel",
                  render: (item) =>
                    item.title,
                },
                {
                  label:
                    "financial.amount",
                  className: "amount",
                  render: (item) =>
                    formatMoney(
                      item.amount,
                      currentClass.currency,
                      currentClass.currencyDecimals,
                    ),
                },
                {
                  label:
                    "financial.dueDate",
                  render: (item) =>
                    item.dueDate,
                },
                {
                  label:
                    "financial.status",
                  render: (item) =>
                    createFinanceStatusBadge(
                      item.status,
                    ),
                },
                {
                  label:
                    "financial.actions",
                  className:
                    "table-actions",
                  render: (item) =>
                    createFinanceRowActions(
                      item,
                      "charge",
                      canOperate,
                      canPay,
                      loadFinances,
                    ),
                },
              ],
              visibleCharges,
              t("common.noData"),
            ),
          );
        };

        chargeSearchInput.addEventListener(
          "input",
          () => {
            chargeSearchQuery =
              chargeSearchInput.value;

            renderChargesTable();
          },
        );

        renderChargesTable();

        chargesSection.append(
          createFinanceSectionTitle(
            "financial.charges",
            charges.length,
            createChargeButton,
          ),
          chargeSearchGroup,
          chargesTableContainer,
        );

        const expensesSection =
          createElement("section", {
            className:
              "finance-section",
          });

        expensesSection.append(
          createFinanceSectionTitle(
            "financial.expenses",
            expenses.length,
            createExpenseButton,
          ),
          createFinanceTable(
            [
              {
                label:
                  "financial.titleLabel",
                render: (item) =>
                  item.title,
              },
              {
                label:
                  "financial.category",
                render: (item) =>
                  item.category || "—",
              },
              {
                label:
                  "financial.amount",
                className: "amount",
                render: (item) =>
                  formatMoney(
                    item.amount,
                    currentClass.currency,
                    currentClass.currencyDecimals,
                  ),
              },
              {
                label:
                  "financial.expenseDate",
                render: (item) =>
                  item.expenseDate,
              },
              {
                label:
                  "financial.status",
                render: (item) =>
                  createFinanceStatusBadge(
                    item.status,
                  ),
              },
              {
                label: "financial.actions",
                className: "table-actions",
                render: (item) =>
                  createFinanceRowActions(
                    item,
                    "expense",
                    canOperate,
                    canPay,
                    loadFinances,
                  ),
              },
            ],
            expenses,
            t("common.noData"),
          ),
        );

        const transactionsSection =
          createElement(
            "section",
            {
              className:
                "finance-section",
            },
          );

        transactionsSection.append(
          createFinanceSectionTitle(
            "financial.transactions",
            financialTransactions.length,
            createTransactionButton,
          ),
          createFinanceTable(
            [
              {
                label:
                  "financial.category",
                render: (item) =>
                  item.categoryName ||
                  item.categoryCode ||
                  "—",
              },
              {
                label:
                  "financial.description",
                render: (item) =>
                  item.description ||
                  "—",
              },
              {
                label:
                  "financial.amount",
                className: "amount",
                render: (item) =>
                  formatMoney(
                    item.amount,
                    currentClass.currency,
                    currentClass.currencyDecimals,
                  ),
              },
              {
                label:
                  "financial.status",
                render: (item) =>
                  createFinanceStatusBadge(
                    item.status,
                  ),
              },
              {
                label: "financial.actions",
                className: "table-actions",
                render: (item) =>
                  createFinanceRowActions(
                    item,
                    "financialTransaction",
                    canOperate,
                    canPay,
                    loadFinances,
                  ),
              },
            ],
            financialTransactions,
            t("common.noData"),
          ),
        );

        content.replaceChildren(
          summary,
          chargesSection,
          expensesSection,
          transactionsSection,
        );
      } catch (error) {
        console.error(
          "Failed to load finances:",
          error,
        );

        description.textContent =
          t("errors.network");

        content.replaceChildren(
          createElement("p", {
            className:
              "content-panel-message error",
            text: t(
              "messages.operationFailed",
            ),
          }),
        );
      }
    };

  cancelledCheckbox.addEventListener(
    "change",
    async () => {
      financesIncludeCancelled =
        cancelledCheckbox.checked;

      await loadFinances();
    },
  );

  try {
    const result =
      await getClasses(false);

    const classes =
      result?.data?.classes ?? [];

    classSelect.replaceChildren();

    for (const classItem of classes) {
      const option = createElement(
        "option",
        {
          text: `${classItem.code} – ${classItem.displayName}`,
          attributes: {
            value: String(
              classItem.id,
            ),
          },
        },
      );

      classSelect.append(
        option,
      );
    }

    if (classes.length === 0) {
      classSelect.disabled =
        true;

      description.textContent =
        t("common.noData");

      content.replaceChildren(
        createElement("p", {
          className:
            "content-panel-message",
          text: t(
            "common.noData",
          ),
        }),
      );

      return section;
    }

    const selectedClassExists =
      classes.some(
        (classItem) =>
          classItem.id ===
          financesClassId,
      );

    if (!selectedClassExists) {
      financesClassId =
        classes[0].id;
    }

    classSelect.value =
      String(financesClassId);

    classSelect.addEventListener(
      "change",
      async () => {
        financesClassId =
          Number(
            classSelect.value,
          );

        await loadFinances();
      },
    );

    await loadFinances();
  } catch (error) {
    console.error(
      "Failed to load classes for finances:",
      error,
    );

    classSelect.disabled =
      true;

    description.textContent =
      t("errors.network");

    content.replaceChildren(
      createElement("p", {
        className:
          "content-panel-message error",
        text: t(
          "messages.operationFailed",
        ),
      }),
    );
  }

  return section;
}

function createEmptyView(view) {
  const translation =
    viewTranslations[view];

  const section = createElement(
    "section",
    {
      className:
        "content-view",
    },
  );

  const header = createElement(
    "div",
    {
      className:
        "content-view-header",
    },
  );

  const title = createElement("h1", {
    className: "page-title",
    text: t(translation.title),
  });

  const description = createElement(
    "p",
    {
      className:
        "page-description",
      text: t(
        translation.description,
      ),
    },
  );

  header.append(
    title,
    description,
  );

  const emptyState =
    createElement("div", {
      className:
        "empty-state",
    });

  const emptyTitle =
    createElement("h2", {
      className:
        "empty-state-title",
      text: t(
        translation.title,
      ),
    });

  const emptyDescription =
    createElement("p", {
      className:
        "empty-state-description",
      text: t(
        "common.noData",
      ),
    });

  emptyState.append(
    emptyTitle,
    emptyDescription,
  );

  section.append(
    header,
    emptyState,
  );

  return section;
}

async function createMain(
  currentView,
) {
  const main = createElement("main", {
    className: "app-main",
  });

  if (currentView === "dashboard") {
    main.append(
      createDashboardView(),
    );
  } else if (
    currentView === "classes"
  ) {
    main.append(
      await createClassesView(),
    );
  } else if (
    currentView === "children"
  ) {
    main.append(
      await createChildrenView(),
    );
  } else if (
    currentView === "finances"
  ) {
    main.append(
      await createFinancesView(),
    );
  } else {
    main.append(
      createEmptyView(
        currentView,
      ),
    );
  }

  return main;
}

async function render() {
  const currentView =
    getCurrentView();

  app.replaceChildren();

  const shell = createElement(
    "div",
    {
      className:
        "app-shell",
    },
  );

  const header =
    createHeader();

  const layout =
    createElement("div", {
      className:
        "app-layout",
    });

  const navigation =
    createNavigation(
      currentView,
    );

  const main =
    await createMain(
      currentView,
    );

  layout.append(
    navigation,
    main,
  );

  shell.append(
    header,
    layout,
  );

  app.append(shell);
}

async function startApp() {
  try {
    await initI18n();

    const me = await getMe();
    currentUser =
      me?.data?.user ?? null;

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
        className:
          "app-error",
        text:
          "ClassMoney failed to start.",
      }),
    );
  }
}

startApp();
