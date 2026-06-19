import { mutation } from "@flex/core";

const servicesSeed = [
  {
    slug: "landing",
    title: "Лендинг",
    description: "Одностраничный сайт для продажи продукта или услуги с высокой конверсией.",
    price: "от 25 000 ₽",
    features: ["Адаптивная вёрстка", "SEO-оптимизация", "Форма заявки", "Срок: 5–7 дней"],
    badge: "Популярное",
    sortOrder: 0,
  },
  {
    slug: "business",
    title: "Корпоративный сайт",
    description: "Многостраничный сайт для компании с разделами услуг, команды и контактов.",
    price: "от 55 000 ₽",
    features: ["До 10 страниц", "CMS для контента", "Аналитика", "Срок: 14–21 день"],
    sortOrder: 1,
  },
  {
    slug: "shop",
    title: "Интернет-магазин",
    description: "Полноценный e-commerce с каталогом, корзиной и онлайн-оплатой.",
    price: "от 90 000 ₽",
    features: ["Каталог товаров", "Корзина и оплата", "Личный кабинет", "Срок: 21–30 дней"],
    badge: "Premium",
    sortOrder: 2,
  },
  {
    slug: "redesign",
    title: "Редизайн",
    description: "Обновление существующего сайта: новый дизайн, UX и современный стек.",
    price: "от 35 000 ₽",
    features: ["Аудит текущего сайта", "Новый UI/UX", "Миграция контента", "Срок: 10–14 дней"],
    sortOrder: 3,
  },
];

const cmsBlocksSeed = [
  { page: "home", key: "home.hero.tagline", type: "text" as const, value: "Сервис по продаже сайтов", sortOrder: 0 },
  { page: "home", key: "home.hero.title", type: "text" as const, value: "Создаём сайты,", sortOrder: 1 },
  { page: "home", key: "home.hero.titleHighlight", type: "text" as const, value: "которые продают", sortOrder: 2 },
  {
    page: "home",
    key: "home.hero.description",
    type: "text" as const,
    value: "SiteForge — студия полного цикла. От лендинга до интернет-магазина: дизайн, разработка, запуск и поддержка.",
    sortOrder: 3,
  },
  { page: "home", key: "home.hero.btnServices", type: "button" as const, value: "Смотреть услуги", meta: { href: "/services" }, sortOrder: 4 },
  { page: "home", key: "home.hero.btnReviews", type: "button" as const, value: "Читать отзывы", meta: { href: "/reviews" }, sortOrder: 5 },
  { page: "home", key: "home.stat.0.value", type: "text" as const, value: "150+", sortOrder: 6 },
  { page: "home", key: "home.stat.0.label", type: "text" as const, value: "Сайтов запущено", sortOrder: 7 },
  { page: "home", key: "home.stat.1.value", type: "text" as const, value: "4.9", sortOrder: 8 },
  { page: "home", key: "home.stat.1.label", type: "text" as const, value: "Средняя оценка", sortOrder: 9 },
  { page: "home", key: "home.stat.2.value", type: "text" as const, value: "7 дн.", sortOrder: 10 },
  { page: "home", key: "home.stat.2.label", type: "text" as const, value: "Срок лендинга", sortOrder: 11 },
  { page: "home", key: "home.services.title", type: "text" as const, value: "Популярные услуги", sortOrder: 12 },
  { page: "home", key: "home.services.link", type: "button" as const, value: "Все услуги →", meta: { href: "/services" }, sortOrder: 13 },
  { page: "home", key: "home.review.title", type: "text" as const, value: "Последний отзыв", sortOrder: 14 },
  { page: "services", key: "services.page.title", type: "text" as const, value: "Услуги", sortOrder: 0 },
  { page: "services", key: "services.page.description", type: "text" as const, value: "Выберите формат сайта — мы разработаем, запустим и передадим готовый продукт.", sortOrder: 1 },
  { page: "reviews", key: "reviews.page.title", type: "text" as const, value: "Отзывы", sortOrder: 0 },
  { page: "reviews", key: "reviews.page.description", type: "text" as const, value: "Что говорят клиенты о работе с SiteForge.", sortOrder: 1 },
];

const reviewsSeed = [
  { name: "Алексей Иванов", role: "CEO, TechStart", text: "Заказали лендинг для запуска продукта — получили за 6 дней. Конверсия выросла на 40%. Отличная команда!", rating: 5, date: "15.03.2026", sortOrder: 0 },
  { name: "Мария Петрова", role: "Владелец салона красоты", text: "Сделали красивый сайт с онлайн-записью. Клиенты теперь записываются сами, звонков стало меньше.", rating: 5, date: "02.03.2026", sortOrder: 1 },
  { name: "Дмитрий Козлов", role: "Маркетолог, RetailPro", text: "Интернет-магазин запустили в срок. Интеграция с оплатой и доставкой работает без сбоев.", rating: 4, date: "20.02.2026", sortOrder: 2 },
  { name: "Елена Сидорова", role: "Фрилансер", text: "Редизайн портфолио полностью обновил мой имидж. Получаю больше заказов после запуска.", rating: 5, date: "10.02.2026", sortOrder: 3 },
];

const navItemsSeed = [
  { path: "/", label: "Главная", icon: "🏠", sortOrder: 0 },
  { path: "/services", label: "Услуги", icon: "⚡", sortOrder: 1 },
  { path: "/reviews", label: "Отзывы", icon: "💬", sortOrder: 2 },
];

export const seedIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const existingServices = await ctx.db.query("services").collect();
    if (existingServices.length > 0) return { seeded: false };

    for (const service of servicesSeed) {
      await ctx.db.insert("services", service);
    }
    for (const review of reviewsSeed) {
      await ctx.db.insert("reviews", review);
    }
    for (const block of cmsBlocksSeed) {
      await ctx.db.insert("cmsBlocks", block);
    }
    for (const item of navItemsSeed) {
      await ctx.db.insert("navItems", item);
    }

    return { seeded: true };
  },
});
