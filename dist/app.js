'use strict';
const storageKeys = {
  reservations: 'instock.reservations',
  offerChanges: 'instock.offerChanges',
  addedOffers: 'instock.addedOffers',
  merchantStore: 'instock.merchantStore',
  seededStores: 'instock.seededStores',
};
const hourMs = 3600000;
const reservationLifetimeMs = 24 * hourMs;
const lowStockLimit = 3;
const visualSearchDelayMs = 1500;
const distanceOptions = [['', 'Любое'], ['2', 'до 2 км'], ['5', 'до 5 км'], ['10', 'до 10 км']];
const sortOptions = [['near', 'Ближайшие'], ['cheap', 'Дешевле'], ['rating', 'По рейтингу магазина']];
const reservationStatusLabels = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  expired: 'Истекла',
  collected: 'Выкуплена',
  cancelled: 'Отменена',
  rejected: 'Отклонена магазином',
};
const categoryIcons = {
  dishes: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M4 21h14"/>',
  decor: '<path d="M9 21h6l1-7H8zM12 14V9"/><path d="M12 10c-3 0-5-2-5-5 3 0 5 2 5 5zm0-1c0-3 2-5 5-5 0 3-2 5-5 5z"/>',
  clothing: '<path d="M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3c0 2-1.5 3-4 3S8 5 8 3z"/>',
  gifts: '<path d="M4 11h16v10H4zM3 7h18v4H3zm9 0v14"/><path d="M12 7c-2-4-6-4-6-1.5S10 7 12 7zm0 0c2-4 6-4 6-1.5S14 7 12 7z"/>',
  accessories: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  kids: '<path d="M4 14h7v7H4zm9 0h7v7h-7zM8.5 7h7v7h-7z"/>',
};
const cameraIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 4.5 4.5"/></svg>';

const pageLoadedAt = Date.now();
const main = document.querySelector('#main');
const headerSearch = document.querySelector('#header-search');
const reservationCounter = document.querySelector('#reservation-count');
const toastElement = document.querySelector('#toast');
const moneyFormat = new Intl.NumberFormat('ru-RU');
const dateFormat = new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'});

let currentPath = null;
let searchState = null;
let visualSearch = {imageUrl: '', scenarioIndex: 0, phase: 'idle', token: 0};
let editingOfferId = '';
let toastTimer = 0;

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const money = value => moneyFormat.format(value) + ' ₸';
const priceRange = (min, max) => min === max ? money(min) : `${moneyFormat.format(min)} – ${money(max)}`;
const storeById = id => stores.find(store => store.id === id);
const productById = id => products.find(product => product.id === id);
const categoryName = id => categories.find(category => category.id === id)?.name || '';
const imageUrl = product => 'assets/' + product.image;
const formatCode = code => `${code.slice(0, 3)} ${code.slice(3)}`;
const compareNumbers = (a, b) => a === b ? 0 : a < b ? -1 : 1;

function plural(count, one, few, many) {
  const mod10 = count % 10, mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast('Не удалось сохранить данные в браузере');
  }
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove('show'), 2600);
}

function loadReservations() {
  return readStorage(storageKeys.reservations, []);
}

function saveReservations(list) {
  writeStorage(storageKeys.reservations, list);
}

function updateReservation(id, changes) {
  saveReservations(loadReservations().map(reservation => reservation.id === id ? {...reservation, ...changes} : reservation));
}

function reservationState(reservation) {
  const holding = reservation.status === 'pending' || reservation.status === 'confirmed';
  return holding && Date.now() >= reservation.createdAt + reservationLifetimeMs ? 'expired' : reservation.status;
}

function isReservationActive(reservation) {
  const state = reservationState(reservation);
  return state === 'pending' || state === 'confirmed';
}

function createReservationRecord(offer, details) {
  return {
    id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    code: String(Math.floor(100000 + Math.random() * 900000)),
    offerId: offer.id,
    productId: offer.productId,
    storeId: offer.storeId,
    price: offer.price,
    status: 'pending',
    createdAt: Date.now(),
    ...details,
  };
}

function allOffers() {
  const changes = readStorage(storageKeys.offerChanges, {});
  const activeReservations = loadReservations().filter(isReservationActive);
  const baseOffers = offers.map(offer => ({...offer, updatedAt: pageLoadedAt - offer.updatedMinutesAgo * 60000, published: true}));
  return [...baseOffers, ...readStorage(storageKeys.addedOffers, [])].map(offer => {
    const merged = {...offer, ...changes[offer.id]};
    const reserved = activeReservations.filter(reservation => reservation.offerId === offer.id).reduce((sum, reservation) => sum + reservation.qty, 0);
    return {...merged, reserved, available: Math.max(0, merged.stock - reserved)};
  });
}

const publishedOffers = () => allOffers().filter(offer => offer.published);

function saveOfferChange(offerId, changes) {
  const allChanges = readStorage(storageKeys.offerChanges, {});
  allChanges[offerId] = {...allChanges[offerId], ...changes};
  writeStorage(storageKeys.offerChanges, allChanges);
}

function distanceKm(store) {
  return Math.hypot(store.x - userLocation.x, store.y - userLocation.y) * metersPerMapUnit / 1000;
}

const byDistance = (a, b) => distanceKm(storeById(a.storeId)) - distanceKm(storeById(b.storeId));

function formatDistance(km) {
  if (!Number.isFinite(km)) return '—';
  return km < 1 ? `${Math.round(km * 100) * 10} м` : `${km.toFixed(1).replace('.', ',')} км`;
}

function formatAgo(timestamp) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'обновлено только что';
  if (minutes < 60) return `обновлено ${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `обновлено ${hours} ч назад`;
  return 'обновлено ' + dateFormat.format(timestamp);
}

function formatCountdown(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const parts = [Math.floor(totalSeconds / 3600), Math.floor(totalSeconds % 3600 / 60), totalSeconds % 60];
  return 'Осталось ' + parts.map(part => String(part).padStart(2, '0')).join(':');
}

function minutesOfDay(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function isOpenNow(store) {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= minutesOfDay(store.opens) && current < minutesOfDay(store.closes);
}

const hoursText = store => `${store.opens}–${store.closes}${isOpenNow(store) ? '' : ', сейчас закрыто'}`;

function stockState(quantity) {
  if (quantity <= 0) return 'out';
  return quantity <= lowStockLimit ? 'low' : 'in';
}

function stockStatus(quantity) {
  const state = stockState(quantity);
  const text = {out: 'Нет в наличии', low: `Осталось ${quantity} шт.`, in: `В наличии ${quantity} шт.`}[state];
  return `<span class="status status-${state}"><span class="dot"></span>${text}</span>`;
}

function storesStatus(count) {
  if (!count) return '<span class="status status-out"><span class="dot"></span>Сейчас нет в наличии</span>';
  return `<span class="status status-in"><span class="dot"></span>В наличии в ${count} ${plural(count, 'магазине', 'магазинах', 'магазинах')}</span>`;
}

const updatedLabel = timestamp => `<span class="updated" data-updated-at="${timestamp}">${formatAgo(timestamp)}</span>`;
const timerLabel = reservation => `<span class="timer" data-deadline="${reservation.createdAt + reservationLifetimeMs}"></span>`;

function reservationStatusLabel(reservation) {
  const state = reservationState(reservation);
  return `<span class="reservation-status is-${state}"><span class="dot"></span>${reservationStatusLabels[state]}</span>`;
}

function summarizeProduct(product, offerList) {
  const productOffers = offerList.filter(offer => offer.productId === product.id);
  const inStock = productOffers.filter(offer => offer.available > 0).sort(byDistance);
  const prices = (inStock.length ? inStock : productOffers).map(offer => offer.price);
  return {
    product,
    offers: productOffers,
    inStock,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    nearest: inStock[0],
    nearestKm: inStock.length ? distanceKm(storeById(inStock[0].storeId)) : Infinity,
    bestRating: Math.max(0, ...inStock.map(offer => storeById(offer.storeId).reliability)),
  };
}

function storeOfferCells(offer, store, state) {
  return {
    main: `<div class="offer-main"><h3>${escapeHtml(store.name)}</h3><p>${escapeHtml(store.address)}</p></div>`,
    meta: `<div class="offer-meta"><strong class="num">${formatDistance(distanceKm(store))}</strong><span>${hoursText(store)}</span><span>Надёжность ${store.reliability}%</span></div>`,
    action: state === 'out'
      ? '<button class="button button-small" type="button" disabled>Забронировать</button>'
      : `<a class="button button-small" href="#/reserve/${offer.id}">Забронировать</a>`,
    extra: '',
  };
}

function merchantOfferCells(offer, product) {
  const editForm = `<form class="offer-edit" data-form="edit-offer" data-id="${offer.id}">
    <label class="field"><span>Цена, ₸</span><input class="input num" type="number" name="price" min="1" step="100" value="${offer.price}" required></label>
    <label class="field"><span>Остаток, шт.</span><input class="input num" type="number" name="stock" min="0" value="${offer.stock}" required></label>
    <button class="button button-small" type="submit">Сохранить</button>
    <button class="button button-small button-quiet" type="button" data-action="cancel-edit">Отмена</button>
  </form>`;
  return {
    main: `<div class="offer-main"><h3><a href="#/product/${product.id}">${escapeHtml(product.name)}</a></h3><p>${categoryName(product.category)}</p></div>`,
    meta: `<div class="offer-meta"><strong>${offer.published ? 'Опубликована' : 'Снята с публикации'}</strong><span>${offer.reserved ? `В брони ${offer.reserved} шт.` : 'Броней нет'}</span></div>`,
    action: `<button class="button button-small button-secondary" type="button" data-action="edit-offer" data-id="${offer.id}">Изменить</button><button class="button button-small button-quiet" type="button" data-action="toggle-offer" data-id="${offer.id}">${offer.published ? 'Снять с публикации' : 'Опубликовать'}</button>`,
    extra: editingOfferId === offer.id ? editForm : '',
  };
}

function offerRow(offer, mode = 'store') {
  const quantity = mode === 'merchant' ? offer.stock : offer.available;
  const state = stockState(quantity);
  const cells = mode === 'merchant'
    ? merchantOfferCells(offer, productById(offer.productId))
    : storeOfferCells(offer, storeById(offer.storeId), state);
  const classes = ['offer-row', state === 'out' ? 'is-out' : '', mode === 'merchant' && !offer.published ? 'is-hidden' : ''].filter(Boolean).join(' ');
  return `<li class="${classes}" data-offer="${offer.id}">${cells.main}${cells.meta}<div class="offer-price">${money(offer.price)}</div><div class="offer-stock">${stockStatus(quantity)}${updatedLabel(offer.updatedAt)}</div><div class="offer-action">${cells.action}</div>${cells.extra}</li>`;
}

function cityMap(points) {
  const markers = points.map(({offer, store, state}) => {
    const labelOnLeft = store.x > 640;
    return `<g class="map-point state-${state}" data-offer="${offer.id}" transform="translate(${store.x} ${store.y})" tabindex="0" role="button" aria-label="${escapeHtml(store.name)}, ${formatDistance(distanceKm(store))}">
      <circle class="hit" r="32"/><circle class="ring" r="25"/><circle class="core" r="13"/>
      <text class="label" x="${labelOnLeft ? -34 : 34}" y="9" text-anchor="${labelOnLeft ? 'end' : 'start'}">${escapeHtml(store.name)}</text>
    </g>`;
  }).join('');
  return `<svg class="city-map" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid slice" role="group" aria-label="Схема Астаны с магазинами">
    <rect class="park" x="600" y="250" width="160" height="44" rx="8"/>
    <rect class="park" x="250" y="410" width="110" height="90" rx="8"/>
    <path class="water" d="M-20 340C120 300 220 390 340 380S540 300 690 330 880 420 1020 390"/>
    <path class="road road-main" d="M40 470H960M500 20v600"/>
    <path class="road" d="M60 200H940M60 110H940M60 560H940M300 30v270M700 30v270M330 430v190M720 430v190"/>
    <text x="40" y="60">Правый берег</text>
    <text x="40" y="620">Левый берег</text>
    <text x="60" y="296">р. Есиль</text>
    <g class="user" transform="translate(${userLocation.x} ${userLocation.y})"><circle r="10"/><circle r="24"/></g>
    <text x="${userLocation.x - 30}" y="${userLocation.y + 44}" text-anchor="end">${userLocation.label}</text>
    ${markers}
  </svg>`;
}

function bindMapLinking(container) {
  let activeId = '';
  const setActive = id => {
    if (id === activeId) return;
    activeId = id;
    container.querySelectorAll('[data-offer]').forEach(element => element.classList.toggle('is-active', element.dataset.offer === id));
  };
  container.querySelectorAll('[data-offer]').forEach(element => {
    element.addEventListener('mouseenter', () => setActive(element.dataset.offer));
    element.addEventListener('mouseleave', () => setActive(''));
    element.addEventListener('focusin', () => setActive(element.dataset.offer));
  });
  container.querySelectorAll('.map-point').forEach(point => {
    const revealRow = () => {
      setActive(point.dataset.offer);
      container.querySelector(`.offer-row[data-offer="${point.dataset.offer}"]`)?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    };
    point.addEventListener('click', revealRow);
    point.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      revealRow();
    });
  });
}

function bindDropzone(zone, onFile) {
  const input = zone.querySelector('input[type="file"]');
  input.addEventListener('change', () => {
    if (input.files[0]) onFile(input.files[0]);
  });
  zone.addEventListener('dragover', event => {
    event.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', event => {
    event.preventDefault();
    zone.classList.remove('is-over');
    const file = [...event.dataTransfer.files].find(item => item.type.startsWith('image/'));
    if (file) onFile(file);
    else showToast('Перетащите файл изображения');
  });
}

function startVisualSearch(imageSource, scenarioIndex) {
  if (visualSearch.imageUrl.startsWith('blob:')) URL.revokeObjectURL(visualSearch.imageUrl);
  const token = visualSearch.token + 1;
  visualSearch = {imageUrl: imageSource, scenarioIndex, phase: 'processing', token};
  setTimeout(() => {
    if (visualSearch.token !== token) return;
    visualSearch.phase = 'done';
    if (parseRoute().name === 'visual') router();
  }, visualSearchDelayMs);
  if (parseRoute().name === 'visual') router();
  else location.hash = '#/visual';
}

const startVisualSearchFromFile = file => startVisualSearch(URL.createObjectURL(file), file.size % visualScenarios.length);

function photoDropzone(large) {
  return `<label class="dropzone ${large ? 'dropzone-large' : ''}" data-dropzone>
    ${large ? cameraIcon.replace('<svg', '<svg class="dropzone-icon"') : ''}
    <span class="button button-secondary">${cameraIcon}Искать по фото</span>
    <p>Перетащите фото или скриншот сюда либо выберите файл</p>
    <input type="file" accept="image/*">
  </label>`;
}

function renderHome() {
  const offerList = publishedOffers();
  const tiles = categories.map(category => {
    const categoryProducts = products.filter(product => product.category === category.id);
    const storeCount = new Set(offerList.filter(offer => offer.available > 0 && categoryProducts.some(product => product.id === offer.productId)).map(offer => offer.storeId)).size;
    return `<a class="category-tile" href="#/search?cat=${category.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${categoryIcons[category.id]}</svg><div><h3>${category.name}</h3><span class="num">${storeCount} ${plural(storeCount, 'магазин', 'магазина', 'магазинов')} с наличием</span></div></a>`;
  }).join('');
  main.innerHTML = `<section class="hero">
      <h1>Найдите вещь в магазинах Астаны</h1>
      <p>Покажем, где она есть прямо сейчас, и отложим её для вас на 24 часа.</p>
      <form class="search-big" data-form="search" role="search">
        ${searchIcon}
        <input type="search" name="q" placeholder="Например, пиалы, шарф или конструктор" aria-label="Что вы ищете">
        <button class="button" type="submit">Найти</button>
      </form>
      <div class="search-or">или</div>
      ${photoDropzone(false)}
    </section>
    <div class="page">
      <section>
        <div class="section-head"><h2>Категории</h2><a href="#/search">Все товары</a></div>
        <div class="category-grid">${tiles}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>Как это работает</h2></div>
        <ol class="steps">
          <li><b>01</b><h3>Найдите</h3><p>Введите запрос или загрузите фото вещи, которую ищете.</p></li>
          <li><b>02</b><h3>Проверьте наличие рядом</h3><p>Сравните цены, остатки и расстояние до магазинов города.</p></li>
          <li><b>03</b><h3>Заберите в магазине</h3><p>Забронируйте на 24 часа и оплатите на месте при получении.</p></li>
        </ol>
      </section>
    </div>`;
  bindDropzone(main.querySelector('[data-dropzone]'), startVisualSearchFromFile);
}

function visualResultsMarkup() {
  if (visualSearch.phase === 'processing') {
    return `<div class="processing" role="status"><h2>Ищем похожие позиции…</h2><div class="progress"><span></span></div><p class="muted small">Сравниваем изображение с товарами в ${stores.length} магазинах Астаны</p></div>`;
  }
  if (visualSearch.phase !== 'done') {
    return '<div class="empty"><h2>Здесь появятся похожие товары</h2><p>Загрузите фото или выберите пример слева.</p></div>';
  }
  const offerList = publishedOffers();
  const cards = visualScenarios[visualSearch.scenarioIndex].matches.map(([productId, score]) => {
    const summary = summarizeProduct(productById(productId), offerList);
    const priceText = summary.offers.length ? `от ${money(summary.minPrice)}` : '';
    return `<a class="match-card" href="#/product/${productId}">
      <div class="thumb"><img src="${imageUrl(summary.product)}" alt="" loading="lazy"></div>
      <div class="match-score"><span>Совпадение</span><strong>${score}%</strong></div>
      <h3>${escapeHtml(summary.product.name)}</h3>
      ${storesStatus(summary.inStock.length)}
      <span class="small muted num">${priceText}</span>
    </a>`;
  }).join('');
  return `<div class="result-bar"><h2>Похожие товары</h2><span class="small muted">Демо: соответствия заданы заранее</span></div><div class="match-grid appear">${cards}</div>`;
}

function renderVisual() {
  const samples = visualScenarios.map((scenario, index) => {
    const product = productById(scenario.sampleProductId);
    return `<button type="button" data-action="visual-sample" data-index="${index}" aria-label="Пример: ${escapeHtml(product.name)}"><img src="${imageUrl(product)}" alt=""></button>`;
  }).join('');
  const source = visualSearch.imageUrl
    ? `<div class="preview"><img src="${escapeHtml(visualSearch.imageUrl)}" alt="Загруженное изображение"></div>${photoDropzone(false)}`
    : photoDropzone(true);
  main.innerHTML = `<div class="page">
    <div class="page-head"><h1>Поиск по фото</h1><p>Загрузите фото или скриншот — покажем похожие вещи и магазины, где они есть сейчас.</p></div>
    <div class="visual-layout">
      <aside class="visual-source">${source}<div class="samples"><span class="small muted">Нет фото под рукой? Попробуйте пример</span><div>${samples}</div></div></aside>
      <section aria-live="polite">${visualResultsMarkup()}</section>
    </div>
  </div>`;
  bindDropzone(main.querySelector('[data-dropzone]'), startVisualSearchFromFile);
}

function readSearchState(params) {
  return {
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    min: params.get('min') || '',
    max: params.get('max') || '',
    today: params.get('today') === '1',
    dist: params.get('dist') || '',
    sort: sortOptions.some(([value]) => value === params.get('sort')) ? params.get('sort') : 'near',
  };
}

function searchHash(state) {
  const params = new URLSearchParams();
  ['q', 'cat', 'min', 'max', 'dist'].forEach(key => {
    if (state[key]) params.set(key, state[key]);
  });
  if (state.today) params.set('today', '1');
  if (state.sort && state.sort !== 'near') params.set('sort', state.sort);
  const query = params.toString();
  return '#/search' + (query ? '?' + query : '');
}

function matchesQuery(product, query) {
  const haystack = [product.name, categoryName(product.category), ...product.tags].join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean)
    .map(word => word.length > 3 ? word.slice(0, Math.max(3, word.length - 2)) : word)
    .every(stem => haystack.includes(stem));
}

function filterProducts(state) {
  const offerList = publishedOffers();
  const minPrice = Number(state.min) || 0;
  const maxPrice = Number(state.max) || Infinity;
  const maxKm = Number(state.dist) || Infinity;
  const comparators = {
    near: (a, b) => compareNumbers(a.nearestKm, b.nearestKm),
    cheap: (a, b) => a.minPrice - b.minPrice,
    rating: (a, b) => b.bestRating - a.bestRating,
  };
  return products
    .map(product => summarizeProduct(product, offerList))
    .filter(summary => summary.offers.length)
    .filter(summary => matchesQuery(summary.product, state.q))
    .filter(summary => !state.cat || summary.product.category === state.cat)
    .filter(summary => (summary.inStock.length ? summary.inStock : summary.offers).some(offer => offer.price >= minPrice && offer.price <= maxPrice))
    .filter(summary => !state.today || summary.inStock.length)
    .filter(summary => summary.nearestKm <= maxKm)
    .sort((a, b) => (b.inStock.length > 0) - (a.inStock.length > 0) || comparators[state.sort](a, b));
}

function resultItem(summary, index) {
  const {product, inStock, offers: productOffers} = summary;
  const nearest = summary.nearest
    ? `<div class="result-nearest"><ul class="offer-list">${offerRow(summary.nearest)}</ul></div>`
    : '';
  return `<li class="result-item appear" style="animation-delay:${Math.min(index, 8) * 40}ms">
    <a class="thumb" href="#/product/${product.id}"><img src="${imageUrl(product)}" alt="" loading="lazy"></a>
    <div class="result-info">
      <span class="small muted">${categoryName(product.category)}</span>
      <h3><a href="#/product/${product.id}">${escapeHtml(product.name)}</a></h3>
      <div class="result-facts">${storesStatus(inStock.length)}${inStock.length ? `<span>Ближайший — <strong class="num">${formatDistance(summary.nearestKm)}</strong></span>` : ''}</div>
    </div>
    <div class="result-price">${priceRange(summary.minPrice, summary.maxPrice)}<small>${inStock.length ? 'цены по городу' : `в ${productOffers.length} ${plural(productOffers.length, 'магазине', 'магазинах', 'магазинах')}, нет в наличии`}</small></div>
    ${nearest}
  </li>`;
}

function filtersMarkup() {
  const chip = (key, value, label) => `<button class="chip" type="button" data-action="filter" data-key="${key}" data-value="${value}" aria-pressed="${searchState[key] === value}">${label}</button>`;
  return `<details class="filters" ${window.matchMedia('(max-width: 760px)').matches ? '' : 'open'}>
    <summary>Фильтры <span aria-hidden="true">＋</span></summary>
    <div class="filter-body">
      <fieldset class="filter-group"><legend>Категория</legend><div class="chips">${chip('cat', '', 'Все')}${categories.map(category => chip('cat', category.id, category.name)).join('')}</div></fieldset>
      <fieldset class="filter-group"><legend>Цена, ₸</legend><div class="price-range">
        <input class="input num" type="number" inputmode="numeric" min="0" step="1000" name="min" placeholder="от" aria-label="Цена от" value="${escapeHtml(searchState.min)}">
        <input class="input num" type="number" inputmode="numeric" min="0" step="1000" name="max" placeholder="до" aria-label="Цена до" value="${escapeHtml(searchState.max)}">
      </div></fieldset>
      <fieldset class="filter-group"><legend>Наличие</legend><label class="check"><input type="checkbox" name="today" ${searchState.today ? 'checked' : ''}>Только с наличием сегодня</label></fieldset>
      <fieldset class="filter-group"><legend>Максимальное расстояние</legend><div class="chips">${distanceOptions.map(([value, label]) => chip('dist', value, label)).join('')}</div></fieldset>
      <div><button class="button button-quiet button-small" type="button" data-action="reset-filters">Сбросить фильтры</button></div>
    </div>
  </details>`;
}

function renderSearchResults() {
  const list = main.querySelector('#result-list');
  if (!list) return;
  const results = filterProducts(searchState);
  main.querySelector('#result-count').textContent = `Найдено ${results.length} ${plural(results.length, 'товар', 'товара', 'товаров')}`;
  main.querySelectorAll('[data-action="filter"], [data-action="sort"]').forEach(button => {
    const key = button.dataset.action === 'sort' ? 'sort' : button.dataset.key;
    button.setAttribute('aria-pressed', String(searchState[key] === button.dataset.value));
  });
  list.innerHTML = results.length
    ? results.map(resultItem).join('')
    : '<li class="empty"><h2>Ничего не нашлось</h2><p>Попробуйте другой запрос или ослабьте фильтры.</p><button class="button button-secondary" type="button" data-action="reset-filters">Сбросить фильтры</button></li>';
  updateLiveLabels();
}

function updateSearch(changes) {
  searchState = {...searchState, ...changes};
  history.replaceState(null, '', searchHash(searchState));
  renderSearchResults();
}

function renderSearch(_, params) {
  searchState = readSearchState(params);
  headerSearch.elements.q.value = searchState.q;
  const title = searchState.q ? `«${escapeHtml(searchState.q)}»` : searchState.cat ? categoryName(searchState.cat) : 'Все товары';
  main.innerHTML = `<div class="page">
    <div class="page-head"><h1>${title}</h1><p>Наличие в магазинах Астаны. Расстояние считается от демонстрационной точки «Вы здесь» на Левом берегу.</p></div>
    <div class="search-layout">
      ${filtersMarkup()}
      <section>
        <div class="result-bar"><p id="result-count" class="muted" aria-live="polite"></p><div class="sort" role="group" aria-label="Сортировка">${sortOptions.map(([value, label]) => `<button class="chip" type="button" data-action="sort" data-value="${value}" aria-pressed="${searchState.sort === value}">${label}</button>`).join('')}</div></div>
        <ul class="result-list" id="result-list"></ul>
      </section>
    </div>
  </div>`;
  renderSearchResults();
}

function renderProduct(productId) {
  const product = productById(productId);
  if (!product) return renderNotFound();
  const summary = summarizeProduct(product, publishedOffers());
  const orderedOffers = [...summary.inStock, ...summary.offers.filter(offer => offer.available <= 0).sort(byDistance)];
  const points = orderedOffers.map(offer => ({offer, store: storeById(offer.storeId), state: stockState(offer.available)}));
  const availability = orderedOffers.length
    ? `<div class="availability" id="availability">
        <div class="map-panel" id="map-panel">
          ${cityMap(points)}
          <button class="map-toggle" type="button" data-action="toggle-map" aria-expanded="false"><span>Развернуть карту</span><span class="num">${orderedOffers.length} ${plural(orderedOffers.length, 'точка', 'точки', 'точек')}</span></button>
          <div class="map-legend"><span class="status status-in"><span class="dot"></span>Есть в наличии</span><span class="status status-low"><span class="dot"></span>Осталось мало</span><span class="status status-out"><span class="dot"></span>Нет в наличии</span></div>
        </div>
        <div class="availability-list">
          <div class="list-head"><span>Магазин</span><span>Расстояние и часы</span><span>Цена</span><span>Остаток</span><span></span></div>
          <ul class="offer-list">${orderedOffers.map(offer => offerRow(offer)).join('')}</ul>
        </div>
      </div>`
    : '<div class="empty"><p>Сейчас этот товар не опубликован ни в одном магазине.</p></div>';
  main.innerHTML = `<div class="page">
    <nav class="crumbs" aria-label="Навигация"><a href="#/search">Поиск</a> / <a href="#/search?cat=${product.category}">${categoryName(product.category)}</a></nav>
    <section class="product-head">
      <div class="thumb"><img src="${imageUrl(product)}" alt="${escapeHtml(product.name)}"></div>
      <div class="product-info">
        <h1>${escapeHtml(product.name)}</h1>
        <p>${escapeHtml(product.description)}</p>
        <p class="small muted">${escapeHtml(product.details)}</p>
        <div class="product-summary">
          <div><span>Цены в городе</span><strong>${summary.offers.length ? priceRange(summary.minPrice, summary.maxPrice) : '—'}</strong></div>
          <div><span>Магазинов с наличием</span><strong>${summary.inStock.length} из ${summary.offers.length}</strong></div>
          <div><span>Ближайший</span><strong>${formatDistance(summary.nearestKm)}</strong></div>
        </div>
      </div>
    </section>
    <section>
      <div class="section-head"><h2>Где есть сейчас</h2><span class="small muted">Сначала ближайшие с наличием</span></div>
      ${availability}
    </section>
  </div>`;
  const availabilityElement = main.querySelector('#availability');
  if (availabilityElement) bindMapLinking(availabilityElement);
}

function normalizePhone(value) {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) digits = digits.slice(1);
  if (digits.length !== 10) return '';
  return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}

function renderReserve(offerId) {
  const offer = publishedOffers().find(item => item.id === offerId);
  if (!offer) return renderNotFound();
  const product = productById(offer.productId), store = storeById(offer.storeId);
  const maxQuantity = Math.min(offer.available, 5);
  const back = `<nav class="crumbs" aria-label="Навигация"><a href="#/product/${product.id}">← ${escapeHtml(product.name)}</a></nav>`;
  if (!maxQuantity) {
    main.innerHTML = `<div class="page">${back}<div class="page-head"><h1>Товар закончился</h1><p>В магазине «${escapeHtml(store.name)}» этой позиции больше нет. Посмотрите другие магазины.</p></div><a class="button" href="#/product/${product.id}">Другие магазины</a></div>`;
    return;
  }
  main.innerHTML = `<div class="page">
    ${back}
    <div class="page-head"><h1>Бронирование</h1><p>Магазин отложит товар, а вы заберёте и оплатите его на месте.</p></div>
    <div class="reserve-layout">
      <form class="form" data-form="reserve" novalidate>
        <div class="form-row">
          <label class="field"><span>Имя</span><input class="input" name="name" autocomplete="given-name" required></label>
          <label class="field"><span>Телефон</span><input class="input num" name="phone" type="tel" inputmode="tel" placeholder="+7 700 000 00 00" autocomplete="tel" required></label>
        </div>
        <div class="field"><span>Количество</span>
          <div class="qty"><button type="button" data-step="-1" aria-label="Меньше">−</button><output name="qty" class="num">1</output><button type="button" data-step="1" aria-label="Больше">+</button></div>
          <span class="small muted">Можно отложить до ${maxQuantity} шт.</span>
        </div>
        <label class="field"><span>Комментарий для магазина</span><textarea class="textarea" name="comment" maxlength="300" placeholder="Например, размер или время, когда заедете"></textarea></label>
        <div class="notice"><h3>Оплата в магазине при получении</h3><p>Онлайн-оплаты нет. Бронь держится 24 часа с момента оформления, после этого товар вернётся в продажу.</p></div>
        <div><button class="button" type="submit">Забронировать на 24 часа</button></div>
      </form>
      <aside class="summary">
        <div class="summary-product"><div class="thumb"><img src="${imageUrl(product)}" alt=""></div><div><h3>${escapeHtml(product.name)}</h3>${stockStatus(offer.available)}${updatedLabel(offer.updatedAt)}</div></div>
        <dl>
          <div><dt>Магазин</dt><dd>${escapeHtml(store.name)}</dd></div>
          <div><dt>Адрес</dt><dd>${escapeHtml(store.address)}</dd></div>
          <div><dt>Часы работы</dt><dd>${hoursText(store)}</dd></div>
          <div><dt>Расстояние</dt><dd>${formatDistance(distanceKm(store))}</dd></div>
          <div><dt>Цена за штуку</dt><dd>${money(offer.price)}</dd></div>
          <div class="total"><dt>К оплате в магазине</dt><dd id="reserve-total">${money(offer.price)}</dd></div>
        </dl>
      </aside>
    </div>
  </div>`;
  const form = main.querySelector('[data-form="reserve"]');
  const output = form.elements.qty;
  const syncQuantity = quantity => {
    output.value = quantity;
    form.querySelector('[data-step="-1"]').disabled = quantity <= 1;
    form.querySelector('[data-step="1"]').disabled = quantity >= maxQuantity;
    main.querySelector('#reserve-total').textContent = money(offer.price * quantity);
  };
  form.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
    syncQuantity(Math.min(maxQuantity, Math.max(1, Number(output.value) + Number(button.dataset.step))));
  }));
  syncQuantity(1);
  form.dataset.offer = offer.id;
}

function submitReservation(form) {
  const offer = publishedOffers().find(item => item.id === form.dataset.offer);
  const name = form.elements.name.value.trim();
  const phone = normalizePhone(form.elements.phone.value);
  const quantity = Number(form.elements.qty.value);
  form.querySelectorAll('.field-error').forEach(error => error.remove());
  const errors = [[form.elements.name, name.length >= 2, 'Укажите имя'], [form.elements.phone, Boolean(phone), 'Номер в формате +7 700 000 00 00']];
  errors.forEach(([input, valid, message]) => {
    input.setAttribute('aria-invalid', String(!valid));
    if (!valid) input.insertAdjacentHTML('afterend', `<span class="field-error">${message}</span>`);
  });
  if (errors.some(([, valid]) => !valid)) {
    errors.find(([, valid]) => !valid)[0].focus();
    return;
  }
  if (!offer || offer.available < quantity) {
    showToast('Остаток изменился, выберите другой магазин');
    router();
    return;
  }
  const reservation = createReservationRecord(offer, {name, phone, qty: quantity, comment: form.elements.comment.value.trim(), owner: 'me'});
  saveReservations([...loadReservations(), reservation]);
  showToast('Бронь отправлена в магазин');
  location.hash = '#/reservations/' + reservation.id;
}

function renderReservationDetail(reservationId) {
  const reservation = loadReservations().find(item => item.id === reservationId && item.owner === 'me');
  if (!reservation) return renderNotFound();
  const product = productById(reservation.productId), store = storeById(reservation.storeId);
  const state = reservationState(reservation), active = isReservationActive(reservation);
  const titles = {pending: 'Бронь оформлена', confirmed: 'Товар ждёт вас'};
  const pendingNotice = state === 'pending'
    ? `<div class="notice"><h3>Магазин проверяет наличие</h3><p>Обычно подтверждение приходит в течение 15 минут. В демо подтвердите бронь сами в <a href="#/merchant">панели магазина</a> «${escapeHtml(store.name)}».</p></div>`
    : '';
  main.innerHTML = `<div class="page">
    <nav class="crumbs" aria-label="Навигация"><a href="#/reservations">Мои брони</a></nav>
    <div class="page-head"><h1>${titles[state] || reservationStatusLabels[state]}</h1><p>Назовите код в магазине. Оплата при получении, онлайн платить ничего не нужно.</p></div>
    <div class="ticket">
      <div class="ticket-code">
        <span class="small muted">Код брони</span>
        <strong>${formatCode(reservation.code)}</strong>
        ${active ? timerLabel(reservation) : ''}
        ${reservationStatusLabel(reservation)}
      </div>
      ${pendingNotice}
      <dl>
        <dt>Товар</dt><dd><a href="#/product/${product.id}">${escapeHtml(product.name)}</a>, ${reservation.qty} шт.</dd>
        <dt>Магазин</dt><dd>${escapeHtml(store.name)}</dd>
        <dt>Адрес</dt><dd>${escapeHtml(store.address)} · <span class="num">${formatDistance(distanceKm(store))}</span></dd>
        <dt>Часы работы</dt><dd>${hoursText(store)}</dd>
        <dt>К оплате в магазине</dt><dd class="num">${money(reservation.price * reservation.qty)}</dd>
        <dt>На имя</dt><dd>${escapeHtml(reservation.name)}, <span class="num">${escapeHtml(reservation.phone)}</span></dd>
        <dt>Оформлена</dt><dd>${dateFormat.format(reservation.createdAt)}</dd>
        ${reservation.comment ? `<dt>Комментарий</dt><dd>${escapeHtml(reservation.comment)}</dd>` : ''}
      </dl>
      <div class="ticket-actions">
        ${active ? `<button class="button button-secondary" type="button" data-action="cancel-reservation" data-id="${reservation.id}">Отменить бронь</button>` : ''}
        <a class="button button-quiet" href="#/reservations">Все брони</a>
      </div>
    </div>
  </div>`;
}

function customerReservationRow(reservation) {
  const product = productById(reservation.productId), store = storeById(reservation.storeId);
  const active = isReservationActive(reservation);
  const link = '#/reservations/' + reservation.id;
  return `<li class="reservation-row ${active ? '' : 'is-closed'}">
    <a class="thumb" href="${link}"><img src="${imageUrl(product)}" alt=""></a>
    <div class="reservation-main"><h3><a href="${link}">${escapeHtml(product.name)}</a></h3><p class="num">Код ${formatCode(reservation.code)} · ${reservation.qty} шт. · ${money(reservation.price * reservation.qty)} в магазине</p></div>
    <div class="reservation-place"><strong>${escapeHtml(store.name)}</strong><br>${escapeHtml(store.address)}</div>
    <div class="reservation-time">${reservationStatusLabel(reservation)}${active ? timerLabel(reservation) : ''}</div>
    <div class="reservation-actions">${active ? `<button class="button button-small button-quiet" type="button" data-action="cancel-reservation" data-id="${reservation.id}">Отменить</button>` : ''}<a class="button button-small button-secondary" href="${link}">Открыть</a></div>
  </li>`;
}

function renderReservations(reservationId) {
  if (reservationId) return renderReservationDetail(reservationId);
  const mine = loadReservations().filter(reservation => reservation.owner === 'me');
  const active = mine.filter(isReservationActive).sort((a, b) => a.createdAt - b.createdAt);
  const closed = mine.filter(reservation => !isReservationActive(reservation)).sort((a, b) => b.createdAt - a.createdAt);
  const group = (title, list) => list.length ? `<h2 class="group-title">${title}</h2><ul class="reservation-list">${list.map(customerReservationRow).join('')}</ul>` : '';
  main.innerHTML = `<div class="page">
    <div class="page-head"><h1>Мои брони</h1><p>Брони хранятся в этом браузере. Каждая действует 24 часа с момента оформления, оплата — в магазине.</p></div>
    ${mine.length ? group('Активные', active) + group('Завершённые', closed) : '<div class="empty"><h2>Броней пока нет</h2><p>Найдите товар и отложите его в ближайшем магазине.</p><a class="button" href="#/search">Найти товар</a></div>'}
  </div>`;
}

function seedIncomingReservations(storeId) {
  const seeded = readStorage(storageKeys.seededStores, []);
  if (seeded.includes(storeId)) return;
  const storeOffers = publishedOffers().filter(offer => offer.storeId === storeId && offer.available > 0);
  const guests = demoGuestReservations.slice(0, storeOffers.length).map((guest, index) => {
    const createdAt = Date.now() - guest.hoursAgo * hourMs;
    return createReservationRecord(storeOffers[index], {
      name: guest.name,
      phone: guest.phone,
      qty: Math.min(guest.qty, storeOffers[index].available),
      comment: guest.comment,
      owner: 'guest',
      status: guest.status,
      createdAt,
      confirmedAt: guest.status === 'confirmed' ? createdAt + 600000 : undefined,
    });
  });
  saveReservations([...loadReservations(), ...guests]);
  writeStorage(storageKeys.seededStores, [...seeded, storeId]);
}

function merchantStats(store, storeReservations) {
  const states = storeReservations.map(reservation => [reservationState(reservation), Boolean(reservation.confirmedAt)]);
  const collected = states.filter(([state]) => state === 'collected').length;
  const expiredAfterConfirm = states.filter(([state, wasConfirmed]) => state === 'expired' && wasConfirmed).length;
  const confirmedNow = states.filter(([state, wasConfirmed]) => state === 'confirmed' || state === 'collected' || (state === 'expired' && wasConfirmed)).length;
  const fulfilledBefore = store.history.confirmed * store.history.fulfilled / 100;
  return {
    confirmed: store.history.confirmed + confirmedNow,
    fulfilment: Math.round((fulfilledBefore + collected) / (store.history.confirmed + collected + expiredAfterConfirm) * 100),
    rating: store.reliability,
  };
}

function incomingReservationRow(reservation) {
  const product = productById(reservation.productId);
  const state = reservationState(reservation), active = isReservationActive(reservation);
  const actions = {
    pending: `<button class="button button-small" type="button" data-action="confirm-reservation" data-id="${reservation.id}">Подтвердить</button><button class="button button-small button-quiet" type="button" data-action="reject-reservation" data-id="${reservation.id}">Отклонить</button>`,
    confirmed: `<button class="button button-small button-secondary" type="button" data-action="collect-reservation" data-id="${reservation.id}">Выдано покупателю</button>`,
  };
  return `<li class="reservation-row ${active ? '' : 'is-closed'}">
    <div class="reservation-main"><h3>${escapeHtml(product.name)}, ${reservation.qty} шт.</h3><p class="num">Код ${formatCode(reservation.code)} · ${money(reservation.price * reservation.qty)}</p></div>
    <div class="reservation-place"><strong>${escapeHtml(reservation.name)}</strong> · <span class="num">${escapeHtml(reservation.phone)}</span>${reservation.comment ? `<br>«${escapeHtml(reservation.comment)}»` : ''}</div>
    <div class="reservation-time">${reservationStatusLabel(reservation)}</div>
    <div class="reservation-time">${active ? `${timerLabel(reservation)}<span class="muted">до истечения</span>` : `<span class="muted">${dateFormat.format(reservation.createdAt)}</span>`}</div>
    <div class="reservation-actions">${actions[state] || ''}</div>
  </li>`;
}

function renderMerchantLogin() {
  main.innerHTML = `<div class="page">
    <div class="page-head"><h1>Панель магазина</h1><p>Обновляйте цены и остатки, подтверждайте брони покупателей.</p></div>
    <form class="login" data-form="merchant-login">
      <h2>Вход для магазина</h2>
      <p class="small muted">Демонстрационный вход: выберите магазин, пароль не нужен.</p>
      <label class="field"><span>Магазин</span><select class="select" name="store">${stores.map(store => `<option value="${store.id}">${escapeHtml(store.name)} — ${escapeHtml(store.address)}</option>`).join('')}</select></label>
      <div><button class="button" type="submit">Войти</button></div>
    </form>
  </div>`;
}

function renderMerchant() {
  const store = storeById(readStorage(storageKeys.merchantStore, ''));
  if (!store) return renderMerchantLogin();
  seedIncomingReservations(store.id);
  const storeReservations = loadReservations().filter(reservation => reservation.storeId === store.id);
  const active = storeReservations.filter(isReservationActive).sort((a, b) => a.createdAt - b.createdAt);
  const closed = storeReservations.filter(reservation => !isReservationActive(reservation)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const pendingCount = active.filter(reservation => reservationState(reservation) === 'pending').length;
  const stats = merchantStats(store, storeReservations);
  const storeOffers = allOffers().filter(offer => offer.storeId === store.id);
  const availableProducts = products.filter(product => !storeOffers.some(offer => offer.productId === product.id));
  const addForm = availableProducts.length
    ? `<form class="add-form" data-form="add-offer">
        <label class="field"><span>Товар</span><select class="select" name="product">${availableProducts.map(product => `<option value="${product.id}">${escapeHtml(product.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Цена, ₸</span><input class="input num" type="number" name="price" min="1" step="100" required></label>
        <label class="field"><span>Остаток, шт.</span><input class="input num" type="number" name="stock" min="0" required></label>
        <button class="button" type="submit">Добавить позицию</button>
      </form>`
    : '';
  main.innerHTML = `<div class="page">
    <div class="merchant-head">
      <div class="page-head"><span class="crumbs">Панель магазина</span><h1>${escapeHtml(store.name)}</h1><p>${escapeHtml(store.address)} · ${hoursText(store)}</p></div>
      <button class="button button-quiet" type="button" data-action="merchant-logout">Выйти</button>
    </div>
    <div class="stats">
      <div><span>Подтверждено броней</span><strong>${stats.confirmed}</strong></div>
      <div><span>Процент выполнения</span><strong>${stats.fulfilment}%</strong></div>
      <div><span>Рейтинг надёжности</span><strong>${stats.rating}%</strong></div>
    </div>
    <section class="section incoming">
      <div class="section-head"><h2>Входящие брони</h2><span class="small muted">${pendingCount ? `${pendingCount} ${plural(pendingCount, 'ожидает', 'ожидают', 'ожидают')} подтверждения` : 'Новых нет'}</span></div>
      ${active.length || closed.length ? `<ul class="reservation-list">${[...active, ...closed].map(incomingReservationRow).join('')}</ul>` : '<p class="muted">Броней пока нет.</p>'}
    </section>
    <section class="section merchant-offers">
      <div class="section-head"><h2>Позиции магазина</h2><span class="small muted">${storeOffers.length} ${plural(storeOffers.length, 'позиция', 'позиции', 'позиций')}</span></div>
      <div class="list-head"><span>Товар</span><span>Публикация</span><span>Цена</span><span>Остаток</span><span></span></div>
      <ul class="offer-list">${storeOffers.map(offer => offerRow(offer, 'merchant')).join('')}</ul>
      ${addForm}
    </section>
  </div>`;
  main.querySelector('.offer-edit input')?.focus();
}

function saveEditedOffer(form) {
  const price = Number(form.elements.price.value), stock = Number(form.elements.stock.value);
  if (!(price > 0) || !Number.isInteger(stock) || stock < 0) {
    showToast('Проверьте цену и остаток');
    return;
  }
  saveOfferChange(form.dataset.id, {price, stock, updatedAt: Date.now()});
  editingOfferId = '';
  showToast('Позиция обновлена');
  router();
}

function addOffer(form) {
  const storeId = readStorage(storageKeys.merchantStore, '');
  const price = Number(form.elements.price.value), stock = Number(form.elements.stock.value);
  if (!(price > 0) || !Number.isInteger(stock) || stock < 0) {
    showToast('Проверьте цену и остаток');
    return;
  }
  const added = readStorage(storageKeys.addedOffers, []);
  added.push({id: 'm' + Date.now().toString(36), productId: form.elements.product.value, storeId, price, stock, updatedAt: Date.now(), published: true});
  writeStorage(storageKeys.addedOffers, added);
  showToast('Позиция опубликована');
  router();
}

function renderNotFound() {
  main.innerHTML = '<div class="page"><div class="page-head"><h1>Страница не найдена</h1><p>Возможно, ссылка устарела или позиция снята с публикации.</p></div><a class="button" href="#/">На главную</a></div>';
}

const formHandlers = {
  search: form => {
    location.hash = searchHash({...readSearchState(new URLSearchParams()), q: form.elements.q.value.trim()});
  },
  reserve: submitReservation,
  'merchant-login': form => {
    writeStorage(storageKeys.merchantStore, form.elements.store.value);
    router();
  },
  'edit-offer': saveEditedOffer,
  'add-offer': addOffer,
};

const actions = {
  filter: button => updateSearch({[button.dataset.key]: button.dataset.value}),
  sort: button => updateSearch({sort: button.dataset.value}),
  'reset-filters': () => {
    const reset = {...readSearchState(new URLSearchParams()), q: searchState.q, sort: searchState.sort};
    history.replaceState(null, '', searchHash(reset));
    router();
  },
  'visual-sample': button => {
    const scenarioIndex = Number(button.dataset.index);
    startVisualSearch(imageUrl(productById(visualScenarios[scenarioIndex].sampleProductId)), scenarioIndex);
  },
  'toggle-map': button => {
    const open = main.querySelector('#map-panel').classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
    button.firstElementChild.textContent = open ? 'Свернуть карту' : 'Развернуть карту';
  },
  'cancel-reservation': button => {
    updateReservation(button.dataset.id, {status: 'cancelled'});
    showToast('Бронь отменена');
    router();
  },
  'confirm-reservation': button => {
    updateReservation(button.dataset.id, {status: 'confirmed', confirmedAt: Date.now()});
    showToast('Бронь подтверждена');
    router();
  },
  'reject-reservation': button => {
    updateReservation(button.dataset.id, {status: 'rejected'});
    showToast('Бронь отклонена');
    router();
  },
  'collect-reservation': button => {
    const reservation = loadReservations().find(item => item.id === button.dataset.id);
    const offer = allOffers().find(item => item.id === reservation.offerId);
    updateReservation(reservation.id, {status: 'collected'});
    if (offer) saveOfferChange(offer.id, {stock: Math.max(0, offer.stock - reservation.qty), updatedAt: Date.now()});
    showToast('Товар выдан, остаток уменьшен');
    router();
  },
  'edit-offer': button => {
    editingOfferId = button.dataset.id;
    router();
  },
  'cancel-edit': () => {
    editingOfferId = '';
    router();
  },
  'toggle-offer': button => {
    const offer = allOffers().find(item => item.id === button.dataset.id);
    saveOfferChange(offer.id, {published: !offer.published});
    showToast(offer.published ? 'Позиция снята с публикации' : 'Позиция снова опубликована');
    router();
  },
  'merchant-logout': () => {
    writeStorage(storageKeys.merchantStore, '');
    editingOfferId = '';
    router();
  },
};

main.addEventListener('click', event => {
  const trigger = event.target.closest('[data-action]');
  if (trigger && actions[trigger.dataset.action]) actions[trigger.dataset.action](trigger, event);
});

main.addEventListener('submit', event => {
  const handler = formHandlers[event.target.dataset.form];
  if (!handler) return;
  event.preventDefault();
  handler(event.target);
});

main.addEventListener('input', event => {
  const field = event.target;
  if (field.closest('.filters') && (field.name === 'min' || field.name === 'max')) updateSearch({[field.name]: field.value.trim()});
});

main.addEventListener('change', event => {
  if (event.target.name === 'today') updateSearch({today: event.target.checked});
});

headerSearch.addEventListener('submit', event => {
  event.preventDefault();
  formHandlers.search(headerSearch);
});

window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());

function updateLiveLabels() {
  let expiredNow = false;
  document.querySelectorAll('[data-deadline]').forEach(timer => {
    const left = Number(timer.dataset.deadline) - Date.now();
    if (left > 0) {
      timer.textContent = formatCountdown(left);
      timer.classList.toggle('is-final', left < hourMs);
      return;
    }
    if (!timer.classList.contains('is-over') && timer.textContent) expiredNow = true;
    timer.textContent = 'Время брони истекло';
    timer.classList.remove('is-final');
    timer.classList.add('is-over');
  });
  document.querySelectorAll('[data-updated-at]').forEach(label => {
    label.textContent = formatAgo(Number(label.dataset.updatedAt));
  });
  return expiredNow;
}

function parseRoute() {
  const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
  const [name = '', id] = path.split('/').filter(Boolean);
  return {name, id: id && decodeURIComponent(id), params: new URLSearchParams(query), path};
}

const routes = {
  '': renderHome,
  search: renderSearch,
  visual: renderVisual,
  product: renderProduct,
  reserve: renderReserve,
  reservations: renderReservations,
  merchant: renderMerchant,
};
const navSections = {product: 'search', reserve: 'search'};

function updateChrome(routeName) {
  const section = navSections[routeName] || routeName;
  document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === section));
  headerSearch.hidden = routeName === '';
  if (routeName !== 'search') headerSearch.elements.q.value = '';
  const activeCount = loadReservations().filter(reservation => reservation.owner === 'me' && isReservationActive(reservation)).length;
  reservationCounter.hidden = !activeCount;
  reservationCounter.textContent = activeCount;
}

function router() {
  const route = parseRoute();
  (routes[route.name] || renderNotFound)(route.id, route.params);
  updateChrome(route.name);
  if (route.path !== currentPath) {
    currentPath = route.path;
    window.scrollTo(0, 0);
  }
  updateLiveLabels();
}

window.addEventListener('hashchange', router);
setInterval(() => {
  if (updateLiveLabels()) router();
}, 1000);
router();
