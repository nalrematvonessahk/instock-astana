'use strict';
const storageKeys = {
  reservations: 'instock.v2.reservations',
  offerChanges: 'instock.v2.offerChanges',
  addedOffers: 'instock.v2.addedOffers',
  merchantStore: 'instock.v2.merchantStore',
  seededStores: 'instock.v2.seededStores',
  size: 'instock.v2.size',
};
const hourMs = 3600000;
const reservationLifetimeMs = 24 * hourMs;
const lowStockLimit = {size: 2, total: 3};
const maxPairsPerReservation = 3;
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
  sneakers: '<path d="M3 17v-4l4-1 3-4 3 2c2 2 5 3 8 3v4z"/><path d="M3 17h18M9 11l1.5 1M11 9.5l1.5 1"/>',
  classic: '<path d="M3 16c3 0 6-2 8-6 2 2 5 3 10 4v2.5H3z"/><path d="M3 18.5h18"/>',
  winter: '<path d="M7 3h6v10c3 0 7 1 7 4v2H6z"/><path d="M7 7h6M7 10h6"/>',
  boots: '<path d="M8 3h5v11l6 2c1 .3 2 1 2 2v1H7z"/><path d="M8 7h5"/>',
  kids: '<path d="M4 18v-3l3-1 2-3 3 2c1.5 1 3 2 6 2v3z"/><path d="M4 18h14"/><circle cx="18" cy="6" r="2"/>',
  sport: '<path d="M7 17v-3l3-1 3-4 3 2c2 2 3 3 5 3v3z"/><path d="M2 9h4M1 12h4M7 17h14"/>',
};
const cameraIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const arrowIcon = '<span class="arrow-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg></span>';
const checkIcon = '<svg class="check-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>';
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
const sumValues = map => Object.values(map).reduce((sum, value) => sum + value, 0);

function plural(count, one, few, many) {
  const mod10 = count % 10, mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const pairs = count => `${count} ${plural(count, 'пара', 'пары', 'пар')}`;
const storesCount = count => `${count} ${plural(count, 'магазине', 'магазинах', 'магазинах')}`;

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

function sizeSeries([from, to]) {
  return Array.from({length: to - from + 1}, (_, index) => String(from + index));
}

const sizesOf = product => sizeSeries(product.sizeRange);
const readSavedSize = () => readStorage(storageKeys.size, '');

function saveSize(size) {
  writeStorage(storageKeys.size, size);
}

function sizeOptions(selected, emptyLabel) {
  const options = sizes => sizes.map(size => `<option value="${size}" ${size === selected ? 'selected' : ''}>${size}</option>`).join('');
  return `<option value="">${emptyLabel}</option><optgroup label="Взрослая обувь">${options(sizeSeries(adultSizes))}</optgroup><optgroup label="Детская обувь">${options(sizeSeries(kidsSizes))}</optgroup>`;
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
    const reserved = {};
    activeReservations.filter(reservation => reservation.offerId === offer.id).forEach(reservation => {
      reserved[reservation.size] = (reserved[reservation.size] || 0) + reservation.qty;
    });
    const available = Object.fromEntries(Object.entries(merged.sizes).map(([size, count]) => [size, Math.max(0, count - (reserved[size] || 0))]));
    return {...merged, reserved, available, stockTotal: sumValues(merged.sizes), reservedTotal: sumValues(reserved), availableTotal: sumValues(available)};
  });
}

const publishedOffers = () => allOffers().filter(offer => offer.published);
const availableIn = (offer, size) => size ? offer.available[size] || 0 : offer.availableTotal;

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

function stockState(quantity, size) {
  if (quantity <= 0) return 'out';
  return quantity <= (size ? lowStockLimit.size : lowStockLimit.total) ? 'low' : 'in';
}

function stockStatus(quantity, size) {
  const state = stockState(quantity, size);
  const text = {
    out: size ? `Размера ${size} нет` : 'Нет в наличии',
    low: `Осталось ${pairs(quantity)}`,
    in: `В наличии ${pairs(quantity)}`,
  }[state];
  return `<span class="status status-${state}"><span class="dot"></span>${text}</span>`;
}

function storesStatus(count, size) {
  if (!count) return `<span class="status status-out"><span class="dot"></span>${size ? `Размера ${size} сейчас нет` : 'Сейчас нет в наличии'}</span>`;
  return `<span class="status status-in"><span class="dot"></span>${size ? `Размер ${size} — в ${storesCount(count)}` : `В наличии в ${storesCount(count)}`}</span>`;
}

const updatedLabel = timestamp => `<span class="updated" data-updated-at="${timestamp}">${formatAgo(timestamp)}</span>`;
const timerLabel = reservation => `<span class="timer" data-deadline="${reservation.createdAt + reservationLifetimeMs}"></span>`;

function reservationStatusLabel(reservation) {
  const state = reservationState(reservation);
  return `<span class="reservation-status is-${state}"><span class="dot"></span>${reservationStatusLabels[state]}</span>`;
}

function summarizeProduct(product, offerList, size) {
  const productOffers = offerList.filter(offer => offer.productId === product.id);
  const inStock = productOffers.filter(offer => availableIn(offer, size) > 0).sort(byDistance);
  const prices = (inStock.length ? inStock : productOffers).map(offer => offer.price);
  return {
    product,
    size,
    offers: productOffers,
    inStock,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    nearest: inStock[0],
    nearestKm: inStock.length ? distanceKm(storeById(inStock[0].storeId)) : Infinity,
    bestRating: Math.max(0, ...inStock.map(offer => storeById(offer.storeId).reliability)),
  };
}

const sizeForProduct = (product, size) => sizesOf(product).includes(size) ? size : '';

function sizeGrid(offer, selectedSize) {
  const cells = sizesOf(productById(offer.productId)).map(size => {
    const count = offer.available[size] || 0;
    const selected = size === selectedSize;
    const classes = ['size-cell', count ? 'is-available' : 'is-missing', selected ? 'is-selected' : ''].filter(Boolean).join(' ');
    return `<button class="${classes}" type="button" data-action="pick-size" data-product="${offer.productId}" data-size="${size}" aria-pressed="${selected}" ${count ? '' : 'disabled'} aria-label="Размер ${size}: ${count ? pairs(count) : 'нет'}">${size}</button>`;
  }).join('');
  return `<div class="size-grid" role="group" aria-label="Размеры в магазине">${cells}</div>`;
}

function offerRow(offer, size = '') {
  const store = storeById(offer.storeId);
  const quantity = availableIn(offer, size);
  const state = stockState(quantity, size);
  const reserveHref = `#/reserve/${offer.id}${size ? '?size=' + size : ''}`;
  const action = state === 'out'
    ? '<button class="button button-small" type="button" disabled>Забронировать</button>'
    : `<a class="button button-small" href="${reserveHref}">Забронировать</a>`;
  return `<li class="offer-row ${state === 'out' ? 'is-out' : ''}" data-offer="${offer.id}">
    <div class="offer-main"><h3>${escapeHtml(store.name)}</h3><p>${escapeHtml(store.address)}</p></div>
    <div class="offer-meta"><strong class="num">${formatDistance(distanceKm(store))}</strong><span>${hoursText(store)}</span><span>Надёжность ${store.reliability}%</span></div>
    <div class="offer-price">${money(offer.price)}</div>
    <div class="offer-stock">${stockStatus(quantity, size)}${updatedLabel(offer.updatedAt)}</div>
    <div class="offer-action">${action}</div>
    ${sizeGrid(offer, size)}
  </li>`;
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
    <p>${large ? 'Перетащите фото или скриншот пары сюда либо выберите файл' : 'или перетащите сюда фото пары'}</p>
    <input type="file" accept="image/*">
  </label>`;
}

const stageWord = product => product.tags[0].toUpperCase();

function productCard(summary, index) {
  const {product, inStock, size, nearest} = summary;
  const productHref = `#/product/${product.id}${size ? '?size=' + size : ''}`;
  const tag = inStock.length ? (size ? `Размер ${size}` : 'В наличии') : 'Нет';
  const nearestStore = nearest && storeById(nearest.storeId);
  const nearestBlock = nearest
    ? `<div class="card-nearest">
        <div><span class="small muted">Ближайший</span><strong>${escapeHtml(nearestStore.name)}</strong><span class="small muted num">${formatDistance(summary.nearestKm)} от вас</span></div>
        <a class="button button-small" href="#/reserve/${nearest.id}${size ? '?size=' + size : ''}">Забронировать</a>
      </div>`
    : '<div class="card-nearest is-empty"><span class="small muted">Сейчас нет ни в одном магазине</span></div>';
  return `<article class="product-card appear" style="animation-delay:${Math.min(index, 8) * 50}ms">
    <a class="product-card-media" href="${productHref}" aria-label="${escapeHtml(product.name)}">
      <img src="${imageUrl(product)}" alt="" loading="lazy">
      <span class="tag-vertical ${inStock.length ? '' : 'is-out'}">${tag}</span>
    </a>
    <div class="product-card-body">
      <div class="product-card-title"><h3><a href="${productHref}">${escapeHtml(product.name)}</a></h3><span class="product-card-price num">${inStock.length ? 'от ' + money(summary.minPrice) : money(summary.minPrice)}</span></div>
      <div class="product-card-facts"><span class="small muted">${categoryName(product.category)}</span>${storesStatus(inStock.length, size)}</div>
      ${nearestBlock}
    </div>
  </article>`;
}

function renderHome() {
  const offerList = publishedOffers();
  const savedSize = readSavedSize();
  const pairsNow = offerList.reduce((sum, offer) => sum + offer.availableTotal, 0);
  const lastUpdate = Math.max(...offerList.map(offer => offer.updatedAt));
  const showcase = products
    .map(product => summarizeProduct(product, offerList, sizeForProduct(product, savedSize)))
    .filter(summary => summary.inStock.length)
    .slice(0, 6);
  const categoryCircles = categories.map(category => {
    const categoryProducts = products.filter(product => product.category === category.id);
    const storeCount = new Set(offerList.filter(offer => offer.availableTotal > 0 && categoryProducts.some(product => product.id === offer.productId)).map(offer => offer.storeId)).size;
    return `<a class="category-tile" href="#/search?cat=${category.id}"><span class="category-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${categoryIcons[category.id]}</svg></span><h3>${category.name}</h3><span class="small muted num">${storeCount} ${plural(storeCount, 'магазин', 'магазина', 'магазинов')}</span></a>`;
  }).join('');
  main.innerHTML = `<section class="hero">
      <div class="hero-copy">
        <span class="eyebrow">Обувь в офлайн-магазинах Астаны</span>
        <h1>Найдите свою пару рядом и заберите сегодня</h1>
        <p>Покажем, где модель есть в вашем размере прямо сейчас, и отложим её на 24 часа. Примерка и оплата — в магазине.</p>
        <form class="search-big" data-form="search" role="search">
          ${searchIcon}
          <input type="search" name="q" placeholder="Челси, кеды, дутики…" aria-label="Какую обувь вы ищете">
          <label class="size-select"><span>Мой размер</span><select name="size" data-size-preference>${sizeOptions(savedSize, 'Любой')}</select></label>
          <button class="button button-arrow" type="submit">Найти${arrowIcon}</button>
        </form>
        ${photoDropzone(false)}
      </div>
      <div class="hero-stage">
        <span class="display-word" aria-hidden="true">АСТАНА</span>
        <img src="assets/running-light.jpg" alt="Беговые кроссовки">
        <div class="hero-live">
          <span class="status status-in"><span class="dot"></span>Сейчас в наличии</span>
          <strong class="num">${pairs(pairsNow)}</strong>
          <span>в ${storesCount(stores.length)} города</span>
          ${updatedLabel(lastUpdate)}
        </div>
      </div>
    </section>
    <div class="page">
      <section class="showcase">
        <div class="showcase-head">
          <div><h2 class="section-title">В наличии сегодня</h2><p class="muted">${savedSize ? `Модели, которые есть в вашем ${savedSize} размере.` : 'Модели, которые можно забрать уже сегодня. Укажите размер, чтобы видеть только свои.'}</p></div>
          <div class="showcase-side">
            <span class="display-outline" aria-hidden="true">ОБУВЬ</span>
            <div class="showcase-stats">
              <div><strong class="num">${stores.length}</strong><span>магазинов</span></div>
              <div><strong class="num">${products.length}</strong><span>моделей</span></div>
              <a class="button button-secondary button-small" href="#/search">Смотреть все</a>
            </div>
          </div>
        </div>
        <div class="product-grid">${showcase.map(productCard).join('')}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="section-title">Категории</h2><a href="#/search">Вся обувь</a></div>
        <div class="category-grid">${categoryCircles}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="section-title">Как это работает</h2></div>
        <ol class="steps">
          <li><b class="num">01</b><h3>Найдите</h3><p>Введите запрос или загрузите фото пары и укажите свой размер.</p></li>
          <li><b class="num">02</b><h3>Проверьте наличие рядом</h3><p>Сравните цены и остатки именно вашего размера в магазинах города.</p></li>
          <li><b class="num">03</b><h3>Заберите в магазине</h3><p>Забронируйте на 24 часа, примерьте и оплатите на месте.</p></li>
        </ol>
      </section>
      <section class="section merchant-band">
        <div class="merchant-band-copy"><h2 class="section-title">Вы магазин обуви?</h2><p>Публикуйте остатки по размерам и получайте покупателей, которые приходят наверняка.</p><a class="button button-light button-arrow" href="#/merchant">Панель магазина${arrowIcon}</a></div>
        <ul class="merchant-band-list">
          <li><h3>Остатки по размерам</h3><p>Покупатель видит, есть ли его размер, до того как приехать.</p></li>
          <li><h3>Брони с таймером</h3><p>Пара отложена 24 часа, подтверждение — в один клик.</p></li>
          <li><h3>Рейтинг надёжности</h3><p>Точные остатки поднимают магазин в выдаче.</p></li>
        </ul>
      </section>
    </div>`;
  bindDropzone(main.querySelector('[data-dropzone]'), startVisualSearchFromFile);
}

function visualResultsMarkup() {
  if (visualSearch.phase === 'processing') {
    return `<div class="processing" role="status"><h2>Ищем похожие позиции…</h2><div class="progress"><span></span></div><p class="muted small">Сравниваем изображение с обувью в ${stores.length} магазинах Астаны</p></div>`;
  }
  if (visualSearch.phase !== 'done') {
    return '<div class="empty"><h2>Здесь появятся похожие модели</h2><p>Загрузите фото или выберите пример слева.</p></div>';
  }
  const offerList = publishedOffers();
  const savedSize = readSavedSize();
  const cards = visualScenarios[visualSearch.scenarioIndex].matches.map(([productId, score]) => {
    const product = productById(productId);
    const summary = summarizeProduct(product, offerList, sizeForProduct(product, savedSize));
    const priceText = summary.offers.length ? `от ${money(summary.minPrice)}` : '';
    return `<a class="match-card" href="#/product/${productId}">
      <div class="thumb"><img src="${imageUrl(product)}" alt="" loading="lazy"></div>
      <div class="match-score"><span>Совпадение</span><strong>${score}%</strong></div>
      <h3>${escapeHtml(product.name)}</h3>
      ${storesStatus(summary.inStock.length, summary.size)}
      <span class="small muted num">${priceText}</span>
    </a>`;
  }).join('');
  return `<div class="result-bar"><h2>Похожие модели</h2><span class="small muted">Демо: соответствия заданы заранее</span></div><div class="match-grid appear">${cards}</div>`;
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
    <div class="page-head"><h1>Поиск по фото</h1><p>Загрузите фото или скриншот пары — покажем похожие модели и магазины, где они есть сейчас.</p></div>
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
    size: params.has('size') ? params.get('size') : readSavedSize(),
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
  ['q', 'size', 'cat', 'min', 'max', 'dist'].forEach(key => {
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
    .filter(product => !state.size || sizesOf(product).includes(state.size))
    .map(product => summarizeProduct(product, offerList, state.size))
    .filter(summary => summary.offers.length)
    .filter(summary => matchesQuery(summary.product, state.q))
    .filter(summary => !state.cat || summary.product.category === state.cat)
    .filter(summary => (summary.inStock.length ? summary.inStock : summary.offers).some(offer => offer.price >= minPrice && offer.price <= maxPrice))
    .filter(summary => !state.today || summary.inStock.length)
    .filter(summary => summary.nearestKm <= maxKm)
    .sort((a, b) => (b.inStock.length > 0) - (a.inStock.length > 0) || comparators[state.sort](a, b));
}

function filtersMarkup() {
  const chip = (key, value, label) => `<button class="chip" type="button" data-action="filter" data-key="${key}" data-value="${value}" aria-pressed="${searchState[key] === value}">${label}</button>`;
  return `<details class="filters" ${window.matchMedia('(max-width: 760px)').matches ? '' : 'open'}>
    <summary>Фильтры <span aria-hidden="true">＋</span></summary>
    <div class="filter-body">
      <fieldset class="filter-group filter-primary"><legend>Мой размер</legend>
        <select class="select" name="size" data-size-preference aria-label="Мой размер">${sizeOptions(searchState.size, 'Любой размер')}</select>
        <span class="small muted">Запоминается и подставляется на всех экранах</span>
      </fieldset>
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
  const sizeNote = searchState.size ? ` в размере ${searchState.size}` : '';
  main.querySelector('#result-count').textContent = `Найдено ${results.length} ${plural(results.length, 'модель', 'модели', 'моделей')}${sizeNote}`;
  main.querySelectorAll('[data-action="filter"], [data-action="sort"]').forEach(button => {
    const key = button.dataset.action === 'sort' ? 'sort' : button.dataset.key;
    button.setAttribute('aria-pressed', String(searchState[key] === button.dataset.value));
  });
  list.innerHTML = results.length
    ? results.map(productCard).join('')
    : '<div class="empty"><h2>Ничего не нашлось</h2><p>Попробуйте другой запрос, размер или ослабьте фильтры.</p><button class="button button-secondary" type="button" data-action="reset-filters">Сбросить фильтры</button></div>';
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
  const title = searchState.q ? `«${escapeHtml(searchState.q)}»` : searchState.cat ? categoryName(searchState.cat) : 'Вся обувь';
  main.innerHTML = `<div class="page">
    <div class="page-head"><h1>${title}</h1><p>Наличие по размерам в магазинах Астаны. Расстояние считается от демонстрационной точки «Вы здесь» на Левом берегу.</p></div>
    <div class="search-layout">
      ${filtersMarkup()}
      <section>
        <div class="result-bar"><p id="result-count" class="muted" aria-live="polite"></p><div class="sort" role="group" aria-label="Сортировка">${sortOptions.map(([value, label]) => `<button class="chip" type="button" data-action="sort" data-value="${value}" aria-pressed="${searchState.sort === value}">${label}</button>`).join('')}</div></div>
        <div class="product-grid product-grid-search" id="result-list"></div>
      </section>
    </div>
  </div>`;
  renderSearchResults();
}

function productSize(product, params) {
  const requested = params.get('size');
  if (requested === 'all') return '';
  return sizeForProduct(product, requested || readSavedSize());
}

function sizePicker(product, offerList, selectedSize) {
  const cells = sizesOf(product).map(size => {
    const count = offerList.filter(offer => availableIn(offer, size) > 0).length;
    const selected = size === selectedSize;
    const classes = ['size-option', count ? '' : 'is-missing', selected ? 'is-selected' : ''].filter(Boolean).join(' ');
    return `<button class="${classes}" type="button" data-action="pick-size" data-product="${product.id}" data-size="${size}" aria-pressed="${selected}" ${count ? '' : 'disabled'}><strong>${size}</strong><span>${count ? `${count}\u00a0маг.` : 'нет'}</span></button>`;
  }).join('');
  const title = selectedSize ? `Размер ${selectedSize}` : 'Выберите размер';
  const note = selectedSize ? `<button class="button button-quiet button-small" type="button" data-action="pick-size" data-product="${product.id}" data-size="">Все размеры</button>` : '<span class="small muted">Под размером — число магазинов, где он есть</span>';
  return `<div class="size-picker"><div class="size-picker-head"><h3>${title}</h3>${note}</div><div class="size-options" role="group" aria-label="Размеры">${cells}</div></div>`;
}

function renderProduct(productId, params) {
  const product = productById(productId);
  if (!product) return renderNotFound();
  const size = productSize(product, params);
  const summary = summarizeProduct(product, publishedOffers(), size);
  const listedOffers = size
    ? summary.inStock
    : [...summary.inStock, ...summary.offers.filter(offer => offer.availableTotal <= 0).sort(byDistance)];
  const hiddenCount = summary.offers.length - listedOffers.length;
  const points = listedOffers.map(offer => ({offer, store: storeById(offer.storeId), state: stockState(availableIn(offer, size), size)}));
  const hiddenNote = size && hiddenCount
    ? `<p class="list-note small muted">Ещё в ${storesCount(hiddenCount)} модель есть, но без размера ${size}.</p>`
    : '';
  const availability = listedOffers.length
    ? `<div class="availability" id="availability">
        <div class="map-panel" id="map-panel">
          ${cityMap(points)}
          <button class="map-toggle" type="button" data-action="toggle-map" aria-expanded="false"><span>Развернуть карту</span><span class="num">${listedOffers.length} ${plural(listedOffers.length, 'точка', 'точки', 'точек')}</span></button>
          <div class="map-legend"><span class="status status-in"><span class="dot"></span>Есть в наличии</span><span class="status status-low"><span class="dot"></span>Осталось мало</span><span class="status status-out"><span class="dot"></span>Нет в наличии</span></div>
        </div>
        <div class="availability-list">
          <div class="list-head"><span>Магазин</span><span>Расстояние и часы</span><span>Цена</span><span>${size ? `Размер ${size}` : 'Остаток'}</span><span></span></div>
          <ul class="offer-list">${listedOffers.map(offer => offerRow(offer, size)).join('')}</ul>
          ${hiddenNote}
        </div>
      </div>`
    : `<div class="empty"><p>${size ? `Размера ${size} сейчас нет ни в одном магазине. Выберите другой размер выше.` : 'Сейчас эта модель не опубликована ни в одном магазине.'}</p></div>`;
  const lastUpdate = summary.offers.length ? Math.max(...summary.offers.map(offer => offer.updatedAt)) : Date.now();
  main.innerHTML = `<div class="page page-product">
    <nav class="crumbs" aria-label="Навигация"><a href="#/search">Поиск</a> / <a href="#/search?cat=${product.category}">${categoryName(product.category)}</a></nav>
    <section class="product-stage">
      <span class="display-word" aria-hidden="true">${stageWord(product)}</span>
      <div class="stage-photo"><img src="${imageUrl(product)}" alt="${escapeHtml(product.name)}"></div>
    </section>
    <section class="product-head">
      <div class="product-info">
        <span class="eyebrow">${categoryName(product.category)}</span>
        <h2 class="section-title">О модели</h2>
        <p>${escapeHtml(product.description)}</p>
        <ul class="spec-list">
          ${product.details.split(' · ').map(detail => `<li>${checkIcon}${escapeHtml(detail[0].toUpperCase() + detail.slice(1))}</li>`).join('')}
          <li>${checkIcon}Размеры ${product.sizeRange.join('–')}</li>
          <li>${checkIcon}Примерка и оплата в магазине</li>
        </ul>
      </div>
      <aside class="product-panel">
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-panel-price num">${summary.offers.length ? priceRange(summary.minPrice, summary.maxPrice) : '—'}<small>${size ? `цены на размер ${size}` : 'цены в городе'}</small></p>
        ${sizePicker(product, summary.offers, size)}
        <div class="product-summary">
          <div><span>${size ? `С размером ${size}` : 'С наличием'}</span><strong class="num">${summary.inStock.length} из ${summary.offers.length}</strong></div>
          <div><span>Ближайший</span><strong class="num">${formatDistance(summary.nearestKm)}</strong></div>
        </div>
        <ul class="trust-list">
          <li>${checkIcon}Остатки ${formatAgo(lastUpdate)}</li>
          <li>${checkIcon}Бронь бесплатно на 24 часа</li>
        </ul>
        <button class="button button-arrow button-wide" type="button" data-action="scroll-to-stores" ${listedOffers.length ? '' : 'disabled'}>${listedOffers.length ? `Выбрать магазин · ${listedOffers.length}` : 'Нет в наличии'}${arrowIcon}</button>
      </aside>
    </section>
    <section class="section" id="stores">
      <div class="section-head"><h2 class="section-title">Где есть сейчас</h2><span class="small muted">Сначала ближайшие с наличием</span></div>
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

function renderReserve(offerId, params) {
  const offer = publishedOffers().find(item => item.id === offerId);
  if (!offer) return renderNotFound();
  const product = productById(offer.productId), store = storeById(offer.storeId);
  const availableSizes = sizesOf(product).filter(size => availableIn(offer, size) > 0);
  const back = `<nav class="crumbs" aria-label="Навигация"><a href="#/product/${product.id}">← ${escapeHtml(product.name)}</a></nav>`;
  if (!availableSizes.length) {
    main.innerHTML = `<div class="page">${back}<div class="page-head"><h1>Модель закончилась</h1><p>В магазине «${escapeHtml(store.name)}» этой модели больше нет ни в одном размере. Посмотрите другие магазины.</p></div><a class="button" href="#/product/${product.id}">Другие магазины</a></div>`;
    return;
  }
  const requestedSize = params.get('size') || readSavedSize();
  const initialSize = availableSizes.includes(requestedSize) ? requestedSize : '';
  const sizeOptionsMarkup = sizesOf(product).map(size => {
    const count = availableIn(offer, size);
    return `<option value="${size}" ${size === initialSize ? 'selected' : ''} ${count ? '' : 'disabled'}>${size}${count ? '' : ' — нет'}</option>`;
  }).join('');
  main.innerHTML = `<div class="page">
    ${back}
    <div class="page-head"><h1>Бронирование</h1><p>Магазин отложит пару нужного размера, а вы примерите, заберёте и оплатите её на месте.</p></div>
    <div class="reserve-layout">
      <form class="form" data-form="reserve" data-offer="${offer.id}" novalidate>
        <div class="form-row">
          <label class="field"><span>Размер</span><select class="select num" name="size" required><option value="" ${initialSize ? '' : 'selected'} disabled>Выберите размер</option>${sizeOptionsMarkup}</select></label>
          <div class="field"><span>Количество пар</span>
            <div class="qty"><button type="button" data-step="-1" aria-label="Меньше">−</button><output name="qty" class="num">1</output><button type="button" data-step="1" aria-label="Больше">+</button></div>
          </div>
        </div>
        <div class="form-row">
          <label class="field"><span>Имя</span><input class="input" name="name" autocomplete="given-name" required></label>
          <label class="field"><span>Телефон</span><input class="input num" name="phone" type="tel" inputmode="tel" placeholder="+7 700 000 00 00" autocomplete="tel" required></label>
        </div>
        <label class="field"><span>Комментарий для магазина</span><textarea class="textarea" name="comment" maxlength="300" placeholder="Например, когда заедете на примерку"></textarea></label>
        <div class="notice"><h3>Оплата в магазине при получении</h3><p>Онлайн-оплаты нет. Бронь держится 24 часа с момента оформления, после этого пара вернётся в продажу.</p></div>
        <div><button class="button" type="submit">Забронировать на 24 часа</button></div>
      </form>
      <aside class="summary">
        <div class="summary-product"><div class="thumb"><img src="${imageUrl(product)}" alt=""></div><div><h3>${escapeHtml(product.name)}</h3><div id="reserve-stock"></div>${updatedLabel(offer.updatedAt)}</div></div>
        <dl>
          <div><dt>Размер</dt><dd id="reserve-size" class="num"></dd></div>
          <div><dt>Магазин</dt><dd>${escapeHtml(store.name)}</dd></div>
          <div><dt>Адрес</dt><dd>${escapeHtml(store.address)}</dd></div>
          <div><dt>Часы работы</dt><dd>${hoursText(store)}</dd></div>
          <div><dt>Расстояние</dt><dd>${formatDistance(distanceKm(store))}</dd></div>
          <div><dt>Цена за пару</dt><dd>${money(offer.price)}</dd></div>
          <div class="total"><dt>К оплате в магазине</dt><dd id="reserve-total">${money(offer.price)}</dd></div>
        </dl>
      </aside>
    </div>
  </div>`;
  const form = main.querySelector('[data-form="reserve"]');
  const output = form.elements.qty;
  const syncForm = () => {
    const size = form.elements.size.value;
    const maxQuantity = size ? Math.min(availableIn(offer, size), maxPairsPerReservation) : 1;
    const quantity = Math.min(maxQuantity, Math.max(1, Number(output.value)));
    output.value = quantity;
    form.querySelector('[data-step="-1"]').disabled = quantity <= 1;
    form.querySelector('[data-step="1"]').disabled = quantity >= maxQuantity;
    main.querySelector('#reserve-size').textContent = size || 'не выбран';
    main.querySelector('#reserve-stock').innerHTML = size ? stockStatus(availableIn(offer, size), size) : stockStatus(offer.availableTotal, '');
    main.querySelector('#reserve-total').textContent = money(offer.price * quantity);
  };
  form.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
    output.value = Number(output.value) + Number(button.dataset.step);
    syncForm();
  }));
  form.elements.size.addEventListener('change', () => {
    form.elements.size.removeAttribute('aria-invalid');
    syncForm();
  });
  syncForm();
}

function submitReservation(form) {
  const offer = publishedOffers().find(item => item.id === form.dataset.offer);
  const size = form.elements.size.value;
  const name = form.elements.name.value.trim();
  const phone = normalizePhone(form.elements.phone.value);
  const quantity = Number(form.elements.qty.value);
  form.querySelectorAll('.field-error').forEach(error => error.remove());
  const checks = [
    [form.elements.size, Boolean(size), 'Выберите размер'],
    [form.elements.name, name.length >= 2, 'Укажите имя'],
    [form.elements.phone, Boolean(phone), 'Номер в формате +7 700 000 00 00'],
  ];
  checks.forEach(([input, valid, message]) => {
    input.setAttribute('aria-invalid', String(!valid));
    if (!valid) input.insertAdjacentHTML('afterend', `<span class="field-error">${message}</span>`);
  });
  const firstInvalid = checks.find(([, valid]) => !valid);
  if (firstInvalid) {
    firstInvalid[0].focus();
    return;
  }
  if (!offer || availableIn(offer, size) < quantity) {
    showToast('Остаток изменился, выберите другой размер или магазин');
    router();
    return;
  }
  const reservation = createReservationRecord(offer, {size, name, phone, qty: quantity, comment: form.elements.comment.value.trim(), owner: 'me'});
  saveReservations([...loadReservations(), reservation]);
  showToast('Бронь отправлена в магазин');
  location.hash = '#/reservations/' + reservation.id;
}

function renderReservationDetail(reservationId) {
  const reservation = loadReservations().find(item => item.id === reservationId && item.owner === 'me');
  if (!reservation) return renderNotFound();
  const product = productById(reservation.productId), store = storeById(reservation.storeId);
  const state = reservationState(reservation), active = isReservationActive(reservation);
  const titles = {pending: 'Бронь оформлена', confirmed: 'Пара ждёт вас'};
  const pendingNotice = state === 'pending'
    ? `<div class="notice"><h3>Магазин проверяет наличие размера</h3><p>Обычно подтверждение приходит в течение 15 минут. В демо подтвердите бронь сами в <a href="#/merchant">панели магазина</a> «${escapeHtml(store.name)}».</p></div>`
    : '';
  main.innerHTML = `<div class="page">
    <nav class="crumbs" aria-label="Навигация"><a href="#/reservations">Мои брони</a></nav>
    <div class="page-head"><h1>${titles[state] || reservationStatusLabels[state]}</h1><p>Назовите код в магазине. Примерка и оплата на месте, онлайн платить ничего не нужно.</p></div>
    <div class="ticket">
      <div class="ticket-code">
        <span class="small muted">Код брони</span>
        <strong>${formatCode(reservation.code)}</strong>
        <span class="ticket-size num">Размер ${escapeHtml(reservation.size)} · ${pairs(reservation.qty)}</span>
        ${active ? timerLabel(reservation) : ''}
        ${reservationStatusLabel(reservation)}
      </div>
      ${pendingNotice}
      <dl>
        <dt>Модель</dt><dd><a href="#/product/${product.id}?size=${escapeHtml(reservation.size)}">${escapeHtml(product.name)}</a></dd>
        <dt>Размер</dt><dd class="num">${escapeHtml(reservation.size)}, ${pairs(reservation.qty)}</dd>
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
    <div class="reservation-main"><h3><a href="${link}">${escapeHtml(product.name)}</a></h3><p class="num"><b class="size-inline">Размер ${escapeHtml(reservation.size)}</b> · ${pairs(reservation.qty)} · код ${formatCode(reservation.code)} · ${money(reservation.price * reservation.qty)} в магазине</p></div>
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
    ${mine.length ? group('Активные', active) + group('Завершённые', closed) : '<div class="empty"><h2>Броней пока нет</h2><p>Найдите пару своего размера и отложите её в ближайшем магазине.</p><a class="button" href="#/search">Найти обувь</a></div>'}
  </div>`;
}

function seedIncomingReservations(storeId) {
  const seeded = readStorage(storageKeys.seededStores, []);
  if (seeded.includes(storeId)) return;
  const storeOffers = publishedOffers().filter(offer => offer.storeId === storeId && offer.availableTotal > 0);
  const guests = demoGuestReservations.slice(0, storeOffers.length).map((guest, index) => {
    const offer = storeOffers[index];
    const size = Object.keys(offer.available).find(key => offer.available[key] > 0);
    const createdAt = Date.now() - guest.hoursAgo * hourMs;
    return createReservationRecord(offer, {
      size,
      name: guest.name,
      phone: guest.phone,
      qty: Math.min(guest.qty, offer.available[size]),
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
    <div class="reservation-main with-size"><div class="size-badge"><span>Размер</span><strong>${escapeHtml(reservation.size)}</strong></div><div><h3>${escapeHtml(product.name)}</h3><p class="num">${pairs(reservation.qty)} · код ${formatCode(reservation.code)} · ${money(reservation.price * reservation.qty)}</p></div></div>
    <div class="reservation-place"><strong>${escapeHtml(reservation.name)}</strong> · <span class="num">${escapeHtml(reservation.phone)}</span>${reservation.comment ? `<br>«${escapeHtml(reservation.comment)}»` : ''}</div>
    <div class="reservation-time">${reservationStatusLabel(reservation)}</div>
    <div class="reservation-time">${active ? `${timerLabel(reservation)}<span class="muted">до истечения</span>` : `<span class="muted">${dateFormat.format(reservation.createdAt)}</span>`}</div>
    <div class="reservation-actions">${actions[state] || ''}</div>
  </li>`;
}

function stockGrid(offer) {
  const cells = sizesOf(productById(offer.productId)).map(size => {
    const count = offer.sizes[size] || 0;
    const reserved = offer.reserved[size] || 0;
    return `<span class="stock-cell ${count ? '' : 'is-missing'}"><b>${size}</b><span>${count}</span>${reserved ? `<small>бронь ${reserved}</small>` : ''}</span>`;
  }).join('');
  return `<div class="stock-grid" role="list" aria-label="Остатки по размерам">${cells}</div>`;
}

function sizeInputs(product, values) {
  const inputs = sizesOf(product).map(size => `<label class="size-input"><span>${size}</span><input class="input num" type="number" min="0" step="1" inputmode="numeric" name="size-${size}" value="${values[size] || 0}" aria-label="Размер ${size}, пар"></label>`).join('');
  return `<div class="size-inputs">${inputs}</div>`;
}

function readSizeInputs(form, product) {
  const sizes = {};
  for (const size of sizesOf(product)) {
    const count = Number(form.elements['size-' + size].value);
    if (!Number.isInteger(count) || count < 0) return null;
    if (count) sizes[size] = count;
  }
  return sizes;
}

function merchantOfferRow(offer) {
  const product = productById(offer.productId);
  const editForm = `<form class="offer-edit" data-form="edit-offer" data-id="${offer.id}">
    <label class="field"><span>Цена, ₸</span><input class="input num" type="number" name="price" min="100" step="100" value="${offer.price}" required></label>
    <fieldset class="field size-fieldset"><legend>Остаток по размерам, пар</legend>${sizeInputs(product, offer.sizes)}</fieldset>
    <div class="offer-edit-actions"><button class="button button-small" type="submit">Сохранить</button><button class="button button-small button-quiet" type="button" data-action="cancel-edit">Отмена</button></div>
  </form>`;
  return `<li class="offer-row ${offer.stockTotal ? '' : 'is-out'} ${offer.published ? '' : 'is-hidden'}" data-offer="${offer.id}">
    <div class="offer-main"><h3><a href="#/product/${product.id}">${escapeHtml(product.name)}</a></h3><p>${categoryName(product.category)}</p></div>
    <div class="offer-meta"><strong>${offer.published ? 'Опубликована' : 'Снята с публикации'}</strong><span>${offer.reservedTotal ? `В брони ${pairs(offer.reservedTotal)}` : 'Броней нет'}</span></div>
    <div class="offer-price">${money(offer.price)}</div>
    <div class="offer-stock">${stockStatus(offer.stockTotal, '')}${updatedLabel(offer.updatedAt)}</div>
    <div class="offer-action"><button class="button button-small button-secondary" type="button" data-action="edit-offer" data-id="${offer.id}">Изменить</button><button class="button button-small button-quiet" type="button" data-action="toggle-offer" data-id="${offer.id}">${offer.published ? 'Снять с публикации' : 'Опубликовать'}</button></div>
    ${editingOfferId === offer.id ? editForm : stockGrid(offer)}
  </li>`;
}

function renderMerchantLogin() {
  main.innerHTML = `<div class="page">
    <div class="page-head"><h1>Панель магазина</h1><p>Обновляйте цены и остатки по размерам, подтверждайте брони покупателей.</p></div>
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
        <h3>Новая позиция</h3>
        <div class="add-form-row">
          <label class="field"><span>Модель</span><select class="select" name="product">${availableProducts.map(product => `<option value="${product.id}">${escapeHtml(product.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Цена, ₸</span><input class="input num" type="number" name="price" min="100" step="100" required></label>
        </div>
        <fieldset class="field size-fieldset"><legend>Остаток по размерам, пар</legend><div id="add-sizes">${sizeInputs(availableProducts[0], {})}</div></fieldset>
        <div><button class="button" type="submit">Добавить позицию</button></div>
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
      <div class="list-head"><span>Модель</span><span>Публикация</span><span>Цена</span><span>Остаток</span><span></span></div>
      <ul class="offer-list">${storeOffers.map(merchantOfferRow).join('')}</ul>
      ${addForm}
    </section>
  </div>`;
  main.querySelector('[data-form="add-offer"] [name="product"]')?.addEventListener('change', event => {
    main.querySelector('#add-sizes').innerHTML = sizeInputs(productById(event.target.value), {});
  });
  main.querySelector('.offer-edit input')?.focus();
}

function saveEditedOffer(form) {
  const offer = allOffers().find(item => item.id === form.dataset.id);
  const price = Number(form.elements.price.value);
  const sizes = readSizeInputs(form, productById(offer.productId));
  if (!(price > 0) || !sizes) {
    showToast('Проверьте цену и остатки');
    return;
  }
  saveOfferChange(offer.id, {price, sizes, updatedAt: Date.now()});
  editingOfferId = '';
  showToast('Остатки обновлены');
  router();
}

function addOffer(form) {
  const storeId = readStorage(storageKeys.merchantStore, '');
  const product = productById(form.elements.product.value);
  const price = Number(form.elements.price.value);
  const sizes = readSizeInputs(form, product);
  if (!(price > 0) || !sizes) {
    showToast('Проверьте цену и остатки');
    return;
  }
  const added = readStorage(storageKeys.addedOffers, []);
  added.push({id: 'm' + Date.now().toString(36), productId: product.id, storeId, price, sizes, updatedAt: Date.now(), published: true});
  writeStorage(storageKeys.addedOffers, added);
  showToast('Позиция опубликована');
  router();
}

function renderNotFound() {
  main.innerHTML = '<div class="page"><div class="page-head"><h1>Страница не найдена</h1><p>Возможно, ссылка устарела или позиция снята с публикации.</p></div><a class="button" href="#/">На главную</a></div>';
}

function pickSize(button) {
  const route = parseRoute();
  const size = button.dataset.size;
  if (route.name === 'product') {
    const nextSize = !size || button.getAttribute('aria-pressed') === 'true' ? 'all' : size;
    history.replaceState(null, '', `#/product/${route.id}?size=${nextSize}`);
    router();
    return;
  }
  location.hash = `#/product/${button.dataset.product}?size=${size || 'all'}`;
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
    const reset = {...readSearchState(new URLSearchParams()), q: searchState.q, size: searchState.size, sort: searchState.sort};
    history.replaceState(null, '', searchHash(reset));
    router();
  },
  'pick-size': pickSize,
  'scroll-to-stores': () => main.querySelector('#stores').scrollIntoView({behavior: 'smooth', block: 'start'}),
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
    if (offer) {
      const sizes = {...offer.sizes, [reservation.size]: Math.max(0, (offer.sizes[reservation.size] || 0) - reservation.qty)};
      saveOfferChange(offer.id, {sizes, updatedAt: Date.now()});
    }
    showToast(`Выдано, остаток размера ${reservation.size} уменьшен`);
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
  const field = event.target;
  if (field.matches('[data-size-preference]')) {
    saveSize(field.value);
    if (searchState && field.closest('.filters')) updateSearch({size: field.value});
    showToast(field.value ? `Размер ${field.value} сохранён` : 'Размер сброшен');
  }
  if (field.name === 'today') updateSearch({today: field.checked});
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
