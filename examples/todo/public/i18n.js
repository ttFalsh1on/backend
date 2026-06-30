(function () {
  const STORAGE_LANG = "flex_lang";
  const STR = {
    ru: {
      status_online: "В сети",
      status_ready: "Готов",
      project_empty: "Ваш проект пуст",
      dash_tables: "Таблицы",
      dash_functions: "Функции",
      dash_logs: "Логи",
      dash_data: "Данные",
      back_projects: "← Проекты",
      settings: "Настройки",
      logout: "Выйти",
      language: "Язык",
      two_factor: "Двухфакторная аутентификация",
      method_email: "Почта",
      method_sms: "SMS",
      phone: "Телефон",
      save_settings: "Сохранить",
      profile: "Профиль",
      login_email: "Почта",
      login_phone: "Телефон",
      verify_code: "Код подтверждения",
      confirm: "Подтвердить",
      reg_phone_optional: "Телефон (необязательно)",
      no_logs: "Пока нет логов",
    },
    en: {
      status_online: "Online",
      status_ready: "Ready",
      project_empty: "Your project is empty",
      dash_tables: "Tables",
      dash_functions: "Functions",
      dash_logs: "Logs",
      dash_data: "Data",
      back_projects: "← Projects",
      settings: "Settings",
      logout: "Log out",
      language: "Language",
      two_factor: "Two-factor authentication",
      method_email: "Email",
      method_sms: "SMS",
      phone: "Phone",
      save_settings: "Save",
      profile: "Profile",
      login_email: "Email",
      login_phone: "Phone",
      verify_code: "Verification code",
      confirm: "Confirm",
      reg_phone_optional: "Phone (optional)",
      no_logs: "No logs yet",
    },
  };

  let lang = localStorage.getItem(STORAGE_LANG) || "ru";

  function t(key) {
    return STR[lang]?.[key] ?? STR.ru[key] ?? key;
  }

  function setLang(next) {
    if (next !== "ru" && next !== "en") return;
    lang = next;
    localStorage.setItem(STORAGE_LANG, lang);
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
  }

  setLang(lang);
  window.FlexI18n = { t, setLang, getLang: () => lang };
})();
