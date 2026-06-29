export function apiErrorStatus(message: string): number {
  if (
    /не найден|занят|минимум|пароль|вход|проект|доступ|зарегистрируйтесь|выберите|укажите|добавьте/i.test(
      message
    )
  ) {
    return 400;
  }
  return 500;
}
