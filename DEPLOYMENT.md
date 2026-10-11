# Демо «Корицы» на GitHub Pages

План подготовлен 11 октября 2026 года. Рабочая версия — `koritsa_studio/`: главная, меню и подбор по вкусу. Репозиторий: [alinaaaivanovaaa4-rgb/koritsa-demo](https://github.com/alinaaaivanovaaa4-rgb/koritsa-demo). Публикация через GitHub Pages выполняется из `main`.

## Результат для заказчиков

После публикации сайт будет доступен по HTTPS без установки и входа в GitHub:

- `https://<OWNER>.github.io/koritsa-demo/` — главная;
- `https://<OWNER>.github.io/koritsa-demo/menu.html` — меню;
- `https://<OWNER>.github.io/koritsa-demo/choose.html` — подбор.

Для текущего репозитория `<OWNER>` — `alinaaaivanovaaa4-rgb`, имя — `koritsa-demo`. Адрес демо: `https://alinaaaivanovaaa4-rgb.github.io/koritsa-demo/`.

Для бесплатного демо предлагается публичный репозиторий: его код и фотографии будут доступны всем. GitHub Pages поддерживает публичные репозитории на GitHub Free; публикация из приватного репозитория требует подходящего платного тарифа. Приватный репозиторий сам по себе не закрывает доступ к обычному Pages-сайту. [Тарифы и доступность Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [видимость сайта](https://docs.github.com/en/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site).

## Что уже подготовлено

- `.github/workflows/pages.yml` собирает сайт и публикует его после изменений в `main`; доступен также ручной запуск.
- `tools/prepare_pages.py` генерирует три страницы, собирает `_site/` и проверяет локальные ссылки, изображения, шрифты и пути CSS. Абсолютные пути от корня домена отклоняются, чтобы сайт работал в подпапке репозитория.
- В артефакт входят страницы, CSS, JavaScript и локальные ресурсы с лицензией шрифта. Рабочие документы, исходные PDF, скрейпер, архивы проверки и промпты туда не включаются.
- Сайт статический, отдельный сервер приложения, npm, база данных и платный хостинг для этого демо не нужны. Сборка использует стандартную библиотеку Python.
- Добавлены обложка 1200 × 630, Open Graph и Twitter Card. Главная, меню и подбор имеют свои заголовки, описания и абсолютные HTTPS-адреса. Обложка получает хеш содержимого для обновления кеша. При смене хостинга задавать `SITE_URL` в окружении сборки.

## Порядок публикации

1. Выбрать аккаунт владельца и имя репозитория. Создать на GitHub пустой публичный репозиторий `koritsa-demo`, без автоматически добавленных README и лицензии. [Создание репозитория](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository).

2. Из корня текущего проекта подготовить и проверить файлы:

   ```sh
   cd '/Users/dmitrygordeev/Корица проект'
   python3 tools/prepare_pages.py
   python3 -m http.server 4283 --bind 127.0.0.1 --directory _site
   ```

   Открыть `http://127.0.0.1:4283/`; проверить главную, меню и подбор. Остановить сервер через Ctrl+C.

3. Создать Git-репозиторий и отправить выбранные файлы. Команды ниже предназначены для текущего состояния, где `.git` ещё нет. Заменить `<OWNER>` и, при необходимости, имя репозитория:

   ```sh
   git init -b main
   git add .gitignore DEPLOYMENT.md .github/workflows/pages.yml tools/build_studio.py tools/prepare_pages.py koritsa_studio
   git diff --cached --stat
   git commit -m 'Prepare Koritsa customer demo'
   git remote add origin 'https://github.com/<OWNER>/koritsa-demo.git'
   git push -u origin main
   ```

   В коммит входят только перечисленные файлы. Общий каталог проекта содержит предыдущую версию, исходные материалы и дополнительные инструменты, которые для демо не нужны.

4. В репозитории открыть **Settings → Pages → Build and deployment → Source → GitHub Actions**. Убедиться, что Actions разрешены. Затем открыть **Actions → Publish Koritsa demo → Run workflow**, ветка `main`. Первый автоматический запуск после push может завершиться ошибкой, если Pages ещё не включён; после настройки повторить его вручную. [Настройка источника публикации](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

5. Дождаться зелёных задач `build` и `deploy`. В окружении `github-pages` появится фактическая ссылка; взять адрес оттуда. Проверить главную и прямые адреса `menu.html` / `choose.html`, фотографии, поиск и категории меню, подбор и сравнение, переходы к кофейням, примечания к Instagram. Проверить с телефона, в том числе открытие ссылки из мессенджера.

6. Отправить заказчикам проверенную ссылку на главную. Предлагаемый текст: «Демо сайта “Корица”: главная, меню и подбор по вкусу. Можно посмотреть с телефона и компьютера». Отправка сообщения в этот план не входит.

## Обновления и откат

Изменять `tools/build_studio.py`, CSS/JS и данные в `koritsa_studio/`. Перед отправкой запустить `python3 tools/prepare_pages.py`, затем закоммитить изменения и сделать `git push`: Actions повторит сборку и публикацию. Новые версии CSS и логотипов получают адреса с хешем содержимого.

Для отката отменить конкретный проблемный коммит через `git revert COMMIT_SHA` (подставить его SHA) и отправить исправление в `main`. Это сохранит историю и запустит повторную публикацию. [Рабочий процесс Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Карта загружает Leaflet и тайлы внешнего провайдера по HTTPS; обычные ссылки на маршруты доступны рядом. Главная, фотографии, меню и подбор размещаются локально в артефакте. Доступность Instagram зависит от сети посетителя.

## Примечание к Instagram

Рядом со ссылками стоят звёздочка и пояснение: «Instagram принадлежит компании Meta Platforms Inc., признанной экстремистской организацией, деятельность которой запрещена в РФ».

Оформление со звёздочкой используется, например, на [сайте Surf Coffee](https://www.surfcoffee.ru/admin). Статус сверён по [перечню Минюста РФ](https://minjust.gov.ru/ru/documents/7822/).
