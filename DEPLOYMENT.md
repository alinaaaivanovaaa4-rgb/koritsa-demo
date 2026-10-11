# Демо «Корицы» на GitHub Pages

Настройка выполнена 11 октября 2026 года. Рабочая версия — `koritsa_studio/`: главная, меню и подбор по вкусу. Репозиторий: [alinaaaivanovaaa4-rgb/koritsa-demo](https://github.com/alinaaaivanovaaa4-rgb/koritsa-demo). Публикация через GitHub Pages выполняется из `main`.

## Результат для заказчиков

Адреса GitHub Pages для показа заказчикам без установки и входа в GitHub:

- [Главная](https://alinaaaivanovaaa4-rgb.github.io/koritsa-demo/);
- [Меню](https://alinaaaivanovaaa4-rgb.github.io/koritsa-demo/menu.html);
- [Подбор](https://alinaaaivanovaaa4-rgb.github.io/koritsa-demo/choose.html).

По согласованию с владельцем репозиторий публичный. GitHub отклонил Pages для приватного репозитория на текущем тарифе. GitHub Pages поддерживает публичные репозитории на GitHub Free; публикация из приватного репозитория требует подходящего платного тарифа. [Тарифы и доступность Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Что уже подготовлено

- `.github/workflows/pages.yml` собирает сайт и публикует его после изменений в `main`; доступен также ручной запуск.
- `tools/prepare_pages.py` генерирует три страницы, собирает `_site/` и проверяет локальные ссылки, изображения, шрифты и пути CSS. Абсолютные пути от корня домена отклоняются, чтобы сайт работал в подпапке репозитория.
- В артефакт входят страницы, CSS, JavaScript и локальные ресурсы с лицензией шрифта. Рабочие документы, исходные PDF, скрейпер, архивы проверки и промпты туда не включаются.
- Сайт статический, отдельный сервер приложения, npm, база данных и платный хостинг для этого демо не нужны. Сборка использует стандартную библиотеку Python.
- Добавлены обложка 1200 × 630, Open Graph и Twitter Card. Главная, меню и подбор имеют свои заголовки, описания и абсолютные HTTPS-адреса. Обложка получает хеш содержимого для обновления кеша. При смене хостинга задавать `SITE_URL` в окружении сборки.

## Публикация и проверка

Репозиторий создан, `origin` настроен на `https://github.com/alinaaaivanovaaa4-rgb/koritsa-demo.git`, источник Pages — **GitHub Actions**. При изменении файлов сайта в `main` автоматически запускается [Publish Koritsa demo](https://github.com/alinaaaivanovaaa4-rgb/koritsa-demo/actions).

Перед отправкой обновления:

```sh
cd '/Users/dmitrygordeev/Корица проект'
python3 tools/prepare_pages.py
python3 -m http.server 4283 --bind 127.0.0.1 --directory _site
```

Открыть `http://127.0.0.1:4283/`, проверить изменённые сценарии, затем остановить сервер через Ctrl+C. Добавить в Git только нужные изменения, просмотреть `git diff --cached`, создать коммит и выполнить `git push`. Общий каталог проекта содержит предыдущую версию и исходные материалы; они не нужны для демо.

В Actions дождаться успешных задач `build` и `deploy`. Для ручной публикации: **Actions → Publish Koritsa demo → Run workflow → main**. После публикации проверить главную, прямые адреса `menu.html` / `choose.html`, фотографии, изменённые функции и обложку `assets/social/koritsa-share.jpg`. [Настройка источника публикации](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Текст для отправки заказчикам: «Демо сайта “Корица”: главная, меню и подбор по вкусу. Можно посмотреть с телефона и компьютера». Сообщения заказчикам автоматически не отправляются.

## Обновления и откат

Изменять `tools/build_studio.py`, CSS/JS и данные в `koritsa_studio/`. Перед отправкой запустить `python3 tools/prepare_pages.py`, затем закоммитить изменения и сделать `git push`: Actions повторит сборку и публикацию. Новые версии CSS и логотипов получают адреса с хешем содержимого.

Для отката отменить конкретный проблемный коммит через `git revert COMMIT_SHA` (подставить его SHA) и отправить исправление в `main`. Это сохранит историю и запустит повторную публикацию. [Рабочий процесс Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Карта загружает Leaflet и тайлы внешнего провайдера по HTTPS; обычные ссылки на маршруты доступны рядом. Главная, фотографии, меню и подбор размещаются локально в артефакте. Доступность Instagram зависит от сети посетителя.

## Примечание к Instagram

Рядом со ссылками стоят звёздочка и пояснение: «Instagram принадлежит компании Meta Platforms Inc., признанной экстремистской организацией, деятельность которой запрещена в РФ».

Оформление со звёздочкой используется, например, на [сайте Surf Coffee](https://www.surfcoffee.ru/admin). Статус сверён по [перечню Минюста РФ](https://minjust.gov.ru/ru/documents/7822/).
