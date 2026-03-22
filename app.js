let currentDay = 1;
let budgetChartInstance = null;
const RATE_STORAGE_KEY = "japan_usd_jpy_rate";
const DEFAULT_EXCHANGE_RATE = RATE;
let exchangeRate = DEFAULT_EXCHANGE_RATE;

function formatUsd(value) {
  return `$${Math.round(Number(value)).toLocaleString("en-US")}`;
}

function formatJpy(value) {
  return `¥${Math.round(Number(value)).toLocaleString("en-US")}`;
}

function normalizeRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 100 || rounded > 300) return null;
  return rounded;
}

function readStoredRate() {
  try {
    const stored = localStorage.getItem(RATE_STORAGE_KEY);
    return normalizeRate(stored);
  } catch (error) {
    return null;
  }
}

function persistRate(value) {
  try {
    localStorage.setItem(RATE_STORAGE_KEY, String(value));
  } catch (error) {
    // No-op if storage is unavailable.
  }
}

function updateExchangeRateUI() {
  const sidebar = document.getElementById("exchange-rate-display-sidebar");
  if (sidebar) sidebar.innerText = `${exchangeRate.toLocaleString("en-US")} JPY`;

  const main = document.getElementById("exchange-rate-display-main");
  if (main) main.innerText = exchangeRate.toLocaleString("en-US");

  const input = document.getElementById("exchange-rate-input");
  if (input && document.activeElement !== input) {
    input.value = String(exchangeRate);
  }
}

function applyExchangeRate(nextRate, options = {}) {
  const { persist = true, rerender = true } = options;
  const parsed = normalizeRate(nextRate);
  if (!parsed) return false;

  exchangeRate = parsed;
  updateExchangeRateUI();
  if (persist) persistRate(parsed);

  if (rerender) {
    renderBudget();
    renderSafetyResearch();
  }
  return true;
}

function hydrateExchangeRateControls() {
  const storedRate = readStoredRate();
  if (storedRate) {
    exchangeRate = storedRate;
  }
  updateExchangeRateUI();

  const input = document.getElementById("exchange-rate-input");
  const resetBtn = document.getElementById("exchange-rate-reset");
  if (!input) return;

  const commitInputRate = () => {
    if (!applyExchangeRate(input.value)) {
      input.value = String(exchangeRate);
    }
  };

  input.addEventListener("change", commitInputRate);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitInputRate();
      input.blur();
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      applyExchangeRate(DEFAULT_EXCHANGE_RATE);
    });
  }
}

function buildCriticalCashByDayMap() {
  const map = new Map();
  if (!cashPlan || !Array.isArray(cashPlan.criticalByDay)) return map;
  cashPlan.criticalByDay.forEach((entry) => {
    const match = String(entry).match(/^D(\d+)\s*[^:]*:\s*(.+)$/i);
    if (!match) return;
    map.set(Number(match[1]), match[2].trim());
  });
  return map;
}

const criticalCashByDay = buildCriticalCashByDayMap();

const DEFAULT_ACTIVITY_IMAGE =
  "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80";
const activityImageCache = new Map();
let itineraryImageRenderToken = 0;

const CITY_ACTIVITY_FALLBACK_IMAGES = {
  tokio: "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=1200&q=80",
  kamakura: "https://images.unsplash.com/photo-1684182072724-d322f6dce5a6?auto=format&fit=crop&w=1200&q=80",
  hakone: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80",
  kioto: "https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1200&q=80",
  nara: "https://images.unsplash.com/photo-1619171491373-70d7e3f4f0ea?auto=format&fit=crop&w=1200&q=80",
  osaka: "https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=1200&q=80",
  hiroshima: "https://images.unsplash.com/photo-1654354664957-29948dfae680?auto=format&fit=crop&w=1200&q=80",
  nagasaki: "https://images.unsplash.com/photo-1561640697-2fbf3510a3f4?auto=format&fit=crop&w=1200&q=80",
  kix: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80",
};

function normalizeCityForImage(city) {
  const value = String(city || "").toLowerCase();
  if (value.includes("kix")) return "kix";
  if (value.includes("nara")) return "nara";
  if (value.includes("kamakura")) return "kamakura";
  if (value.includes("hakone")) return "hakone";
  if (value.includes("kioto")) return "kioto";
  if (value.includes("osaka")) return "osaka";
  if (value.includes("hiroshima")) return "hiroshima";
  if (value.includes("nagasaki")) return "nagasaki";
  return "tokio";
}

function getThematicFallbackImage(title) {
  const value = String(title || "").toLowerCase();
  if (/aeropuerto|airport|check-in|vuelo/.test(value)) {
    return "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80";
  }
  if (/templo|santuario|shrine|jingu|dera|ji/.test(value)) {
    return "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1200&q=80";
  }
  if (/tren|shinkansen|station|estación|rail/.test(value)) {
    return "https://images.unsplash.com/photo-1477901492169-d59e6428fc90?auto=format&fit=crop&w=1200&q=80";
  }
  if (/castillo|castle/.test(value)) {
    return "https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1200&q=80";
  }
  if (/universal|nintendo|harry potter|park/.test(value)) {
    return "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=1200&q=80";
  }
  if (/museo|museum|peace/.test(value)) {
    return "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80";
  }
  if (/comida|cena|ramen|sushi|takoyaki|okonomiyaki|izakaya/.test(value)) {
    return "https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=1200&q=80";
  }
  return "";
}

function sanitizeWikiQuery(value) {
  return String(value || "")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeForMatch(value) {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "tokyo",
    "osaka",
    "kyoto",
    "kioto",
    "japan",
    "station",
    "hotel",
    "city",
    "park",
    "temple",
    "shrine",
    "museum",
  ]);
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3 && !stop.has(item));
}

function extractPlaceNameFromMaps(rawUrl) {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl);
    const placeSegment = url.pathname.split("/place/")[1];
    if (placeSegment) {
      return decodeURIComponent(placeSegment).split("/@")[0].replace(/\+/g, " ").replace(/\//g, " ").trim();
    }
    const searchSegment = url.pathname.split("/search/")[1];
    if (searchSegment) {
      return decodeURIComponent(searchSegment).replace(/\+/g, " ").replace(/\//g, " ").trim();
    }
    const queryParam = url.searchParams.get("query");
    if (queryParam) {
      return decodeURIComponent(queryParam).replace(/\+/g, " ").trim();
    }
    return "";
  } catch (error) {
    return "";
  }
}

function buildActivityWikiQueries(dayData, activity) {
  const city = String(dayData.city || "")
    .replace(/\(.*?\)/g, "")
    .trim();
  const placeName = extractPlaceNameFromMaps(activity.maps);
  if (!placeName) return { queries: [], expectedTokens: [] };

  const queries = [`${placeName} ${city} Japan`, `${placeName} Japan`, placeName]
    .map(sanitizeWikiQuery)
    .filter(Boolean);
  const expectedTokens = tokenizeForMatch(placeName);

  return { queries: [...new Set(queries)], expectedTokens };
}

function getActivityImageSet(dayData, activity) {
  const cityKey = normalizeCityForImage(dayData.city);
  const cityFallback = CITY_ACTIVITY_FALLBACK_IMAGES[cityKey] || DEFAULT_ACTIVITY_IMAGE;
  const thematicFallback = getThematicFallbackImage(activity.t);
  const wikiMeta = buildActivityWikiQueries(dayData, activity);
  const primary = thematicFallback || cityFallback || DEFAULT_ACTIVITY_IMAGE;

  const fallbackQueue = [thematicFallback, cityFallback, DEFAULT_ACTIVITY_IMAGE].filter(
    (item, index, arr) => item && item !== primary && arr.indexOf(item) === index,
  );

  return { primary, fallbackQueue, wikiQueries: wikiMeta.queries, wikiExpectedTokens: wikiMeta.expectedTokens };
}

function getActivityImageCacheKey(dayData, activity) {
  return `${dayData.day}|${activity.h}|${activity.t}|${activity.maps || ""}`;
}

async function fetchWikipediaThumbnailForQuery(query, expectedTokens = [], lang = "en") {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "1000",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "5",
    gsrnamespace: "0",
  });

  try {
    const response = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params.toString()}`);
    if (!response.ok) return "";
    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages || {});
    const withThumbnail = pages.filter((page) => page?.thumbnail?.source);
    if (!withThumbnail.length) return "";

    if (!expectedTokens.length) {
      return withThumbnail[0]?.thumbnail?.source || "";
    }

    const minRequiredOverlap = expectedTokens.length >= 3 ? 2 : 1;
    const scored = withThumbnail
      .map((page) => {
        const titleTokens = tokenizeForMatch(page?.title || "");
        const overlap = expectedTokens.filter((token) => titleTokens.includes(token)).length;
        return { overlap, page };
      })
      .sort((a, b) => b.overlap - a.overlap);

    if (!scored.length || scored[0].overlap < minRequiredOverlap) return "";
    return scored[0].page.thumbnail.source || "";
  } catch (error) {
    return "";
  }
}

async function resolveRealActivityImage(dayData, activity) {
  const cacheKey = getActivityImageCacheKey(dayData, activity);
  if (activityImageCache.has(cacheKey)) {
    return activityImageCache.get(cacheKey);
  }

  const imageSet = getActivityImageSet(dayData, activity);
  const queries = imageSet.wikiQueries || [];
  const expectedTokens = imageSet.wikiExpectedTokens || [];
  const langs = ["en", "ja"];
  for (const query of queries) {
    for (const lang of langs) {
      const thumbnail = await fetchWikipediaThumbnailForQuery(query, expectedTokens, lang);
      if (thumbnail) {
        activityImageCache.set(cacheKey, thumbnail);
        return thumbnail;
      }
    }
  }

  activityImageCache.set(cacheKey, "");
  return "";
}

function hydrateActivityImages(dayData, renderToken) {
  const photos = document.querySelectorAll("#timeline-container .activity-photo[data-activity-index]");
  photos.forEach((photo) => {
    const activityIndex = Number(photo.dataset.activityIndex);
    if (!Number.isInteger(activityIndex)) return;
    const activity = dayData.schedule[activityIndex];
    if (!activity) return;

    resolveRealActivityImage(dayData, activity).then((realImageUrl) => {
      if (!realImageUrl) return;
      if (renderToken !== itineraryImageRenderToken) return;
      photo.src = realImageUrl;
      photo.dataset.resolved = "1";
    });
  });
}

function handleActivityImageError(imgElement) {
  const queue = (imgElement.dataset.fallbackQueue || "").split("|").filter(Boolean);
  if (!queue.length) {
    imgElement.onerror = null;
    return;
  }
  const nextUrl = queue.shift();
  imgElement.dataset.fallbackQueue = queue.join("|");
  imgElement.src = nextUrl;
}

function buildItineraryAttentionByDayMap() {
  const map = new Map();
  if (!travelReadiness || !Array.isArray(travelReadiness.itineraryAttentionByDay)) return map;
  travelReadiness.itineraryAttentionByDay.forEach((entry) => {
    const match = String(entry).match(/^D(\d+)\s*[^:]*:\s*(.+)$/i);
    if (!match) return;
    map.set(Number(match[1]), match[2].trim());
  });
  return map;
}

const itineraryAttentionByDay = buildItineraryAttentionByDayMap();

function normalizeMapsUrl(rawUrl) {
  if (!rawUrl) return "#";
  try {
    const url = new URL(rawUrl);
    const coordMatch = `${url.pathname}${url.hash}`.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (coordMatch) {
      return `https://www.google.com/maps/search/?api=1&query=${coordMatch[1]},${coordMatch[2]}`;
    }

    const queryParam = url.searchParams.get("query");
    if (queryParam) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParam)}`;
    }

    const searchSegment = url.pathname.split("/search/")[1];
    if (searchSegment) {
      const cleanSearch = decodeURIComponent(searchSegment).replace(/\+/g, " ").replace(/\//g, " ").trim();
      const query = /japan/i.test(cleanSearch) ? cleanSearch : `${cleanSearch} Japan`;
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }

    const placeSegment = url.pathname.split("/place/")[1];
    if (placeSegment) {
      const cleanPlace = decodeURIComponent(placeSegment)
        .split("/@")[0]
        .replace(/\+/g, " ")
        .replace(/\//g, " ")
        .trim();
      const query = /japan/i.test(cleanPlace) ? cleanPlace : `${cleanPlace} Japan`;
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }

    return rawUrl;
  } catch (error) {
    return rawUrl;
  }
}

function updateTripCountdown() {
  const startDate = new Date(`${TRIP_START}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / 86400000);
  const safeDays = Math.max(diffDays, 0);

  document.getElementById("trip-countdown-days").innerText = safeDays.toLocaleString();
  document.getElementById("trip-countdown-caption").innerText =
    diffDays > 0 ? "días para despegar" : "el viaje ya empezó";
}

function switchTab(id) {
  ["resumen", "itinerario", "pases", "seguridad", "hoteles", "presupuesto"].forEach((t) => {
    document.getElementById("sec-" + t).classList.add("hidden");
    const btn = document.getElementById("nav-" + t);
    btn.classList.remove("bg-japan-red", "text-white", "shadow-lg");
    btn.classList.add("text-gray-500", "hover:bg-gray-50");
  });
  document.getElementById("sec-" + id).classList.remove("hidden");
  const activeBtn = document.getElementById("nav-" + id);
  activeBtn.classList.remove("text-gray-500", "hover:bg-gray-50");
  activeBtn.classList.add("text-white", "bg-japan-red", "shadow-lg");
}

function shortCityLabel(city) {
  if (!city) return "";
  if (/KIX/i.test(city)) return "KIX";
  if (/Nara y Osaka/i.test(city)) return "Nara+Osaka";
  if (/Himeji y Kobe/i.test(city)) return "Himeji+Kobe";
  if (/Viaje a Kioto/i.test(city)) return "Kioto";

  const clean = city.split("·")[0].replace(/\s*\(.*?\)\s*/g, "").trim();
  if (clean.length <= 12) return clean;
  return clean.split(/\s+/)[0];
}

function renderCityOverview() {
  const container = document.getElementById("city-overview");
  if (!container) return;

  const ranges = [];
  itineraryData.forEach((item) => {
    const city = shortCityLabel(item.city);
    const last = ranges[ranges.length - 1];
    if (last && last.city === city && last.end === item.day - 1) {
      last.end = item.day;
    } else {
      ranges.push({ city, start: item.day, end: item.day });
    }
  });

  container.innerHTML = ranges
    .map((range) => {
      const days = range.start === range.end ? `D${range.start}` : `D${range.start}-${range.end}`;
      const currentClass = currentDay >= range.start && currentDay <= range.end ? " is-current" : "";
      return `
              <button type="button" class="city-pill${currentClass}" data-day="${range.start}" aria-label="Ir a ${range.city}">
                  <span class="city-pill-day">${days}</span>
                  <span>${range.city}</span>
              </button>
          `;
    })
    .join("");

  container.querySelectorAll(".city-pill").forEach((pill) => {
    pill.onclick = () => {
      currentDay = Number(pill.dataset.day);
      setActiveDayButton();
      renderItinerary();
      renderCityOverview();
      if (window.innerWidth < 1280) {
        document.getElementById("sec-itinerario").scrollIntoView({ behavior: "smooth" });
      }
    };
  });
}

function setActiveDayButton() {
  document.querySelectorAll("#day-selector button").forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.day) === currentDay);
  });
}

function renderSelectors() {
  const container = document.getElementById("day-selector");
  container.innerHTML = "";

  itineraryData.forEach((d) => {
    const cityLabel = shortCityLabel(d.city);
    const cashCriticalNote = criticalCashByDay.get(d.day);
    const hasCashActivities = d.schedule.some((item) => item.cash);
    const attentionNote = itineraryAttentionByDay.get(d.day);
    const hasAttentionActivities = d.schedule.some((item) => item.attention);
    const dayFlags = [];
    if (cashCriticalNote || hasCashActivities) dayFlags.push('<span class="day-pill-critical" aria-hidden="true">¥</span>');
    if (attentionNote || hasAttentionActivities) dayFlags.push('<span class="day-pill-alert" aria-hidden="true">!</span>');
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.day = d.day;
    b.className = `day-pill${d.day === currentDay ? " is-active" : ""}`;
    b.innerHTML = `
              <span class="day-pill-day">D${d.day}</span>
              <span class="day-pill-dot">•</span>
              <span class="day-pill-city">${cityLabel}</span>
              ${dayFlags.length ? `<span class="day-pill-flags">${dayFlags.join("")}</span>` : ""}
          `;
    b.setAttribute("aria-label", `Ver día ${d.day}`);
    b.title = `Día ${d.day} · ${d.city}${cashCriticalNote || hasCashActivities ? " · Algunos puntos requieren efectivo" : ""}${attentionNote || hasAttentionActivities ? " · Algunos puntos requieren atención" : ""}`;
    b.onclick = () => {
      currentDay = d.day;
      setActiveDayButton();
      renderItinerary();
      if (window.innerWidth < 1280) {
        document.getElementById("sec-itinerario").scrollIntoView({ behavior: "smooth" });
      }
    };
    container.appendChild(b);
  });
}

function renderItinerary() {
  const d = itineraryData.find((x) => x.day === currentDay);
  const renderToken = ++itineraryImageRenderToken;
  const cashCriticalNote = criticalCashByDay.get(d.day);
  const hasCashActivities = d.schedule.some((item) => item.cash);
  const attentionNote = itineraryAttentionByDay.get(d.day);
  const hasAttentionActivities = d.schedule.some((item) => item.attention);
  document.getElementById("daily-title").innerText = d.title;
  const cityEl = document.getElementById("daily-city");
  cityEl.innerText = d.city;
  if (cashCriticalNote || hasCashActivities) {
    cityEl.innerHTML += `<span class="inline-critical-tag" title="Solo algunas actividades del día pueden requerir efectivo">¥ Revisar efectivo</span>`;
  }
  if (attentionNote || hasAttentionActivities) {
    cityEl.innerHTML += `<span class="inline-attention-tag" title="Solo algunas actividades del día requieren atención extra">⚠ Estar atentos</span>`;
  }
  document.getElementById("daily-day-label").innerText = d.day < 10 ? "0" + d.day : d.day;

  const cont = document.getElementById("timeline-container");
  cont.innerHTML = "";
  if (cashCriticalNote || hasCashActivities) {
    cont.innerHTML += `
      <div class="critical-day-alert">
        <span class="critical-day-alert-icon" aria-hidden="true">¥</span>
        <p><strong>Efectivo recomendado hoy:</strong> ${cashCriticalNote ? `${cashCriticalNote} ` : ""}Solo las actividades marcadas con ¥ suelen requerir efectivo.</p>
      </div>
    `;
  }
  if (attentionNote || hasAttentionActivities) {
    cont.innerHTML += `
      <div class="attention-day-alert">
        <span class="attention-day-alert-icon" aria-hidden="true">!</span>
        <p><strong>Atentos hoy:</strong> ${attentionNote ? `${attentionNote} ` : ""}Solo las actividades marcadas con ! requieren atención especial.</p>
      </div>
    `;
  }
  d.schedule.forEach((s, activityIndex) => {
    const mapUrl = normalizeMapsUrl(s.maps);
    const isCashActivity = Boolean(s.cash);
    const isAttentionActivity = Boolean(s.attention);
    const activityImage = getActivityImageSet(d, s);
    cont.innerHTML += `
              <div class="timeline-item relative${isCashActivity ? " cash-critical" : ""}${isAttentionActivity ? " attention-day" : ""}">
                  <div class="flex flex-col md:flex-row items-start gap-6">
                      <span class="time-badge text-base md:text-lg mt-1 flex-shrink-0">${s.h}</span>
                      <div class="flex-1 panel-glass p-6 md:p-8 rounded-3xl border border-white/90 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 group hover:border-japan-red/40 hover:shadow-xl transition-all">
                          <div class="max-w-xl">
                              <div class="activity-photo-shell">
                                <img
                                  loading="lazy"
                                  src="${activityImage.primary}"
                                  data-activity-index="${activityIndex}"
                                  data-fallback-queue="${activityImage.fallbackQueue.join("|")}"
                                  onerror="handleActivityImageError(this)"
                                  alt="Vista referencial de ${s.t} en ${d.city}"
                                  class="activity-photo"
                                />
                                <span class="activity-photo-note">Referencia visual</span>
                              </div>
                              <h4 class="font-black text-xl text-ink mb-3 flex items-center gap-2">
                                <span>${s.t}</span>
                                ${isCashActivity ? '<span class="activity-critical-icon" title="Actividad donde conviene efectivo">¥</span>' : ""}
                                ${isAttentionActivity ? '<span class="activity-attention-icon" title="Actividad con alerta de atención">!</span>' : ""}
                              </h4>
                              <p class="text-[15px] text-gray-600 leading-relaxed font-medium">${s.d}</p>
                          </div>
                          <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" title="Abrir en Google Maps" class="map-link flex-shrink-0 bg-google-blue text-white p-4 rounded-2xl transition-all flex items-center justify-center" aria-label="Abrir ${s.t} en Google Maps">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                          </a>
                      </div>
                  </div>
              </div>
          `;
  });
  hydrateActivityImages(d, renderToken);
}

function hydrateHotelFilters() {
  const cityFilter = document.getElementById("hotel-city-filter");
  const maxPrice = document.getElementById("hotel-max-price");
  const maxPriceLabel = document.getElementById("hotel-max-price-label");
  const uniqueCities = [...new Set(hotels.map((hotel) => hotel.city))];

  uniqueCities.forEach((city) => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    cityFilter.appendChild(option);
  });

  const updateAndRender = () => {
    maxPriceLabel.innerText = formatUsd(maxPrice.value);
    renderHotels();
  };

  cityFilter.addEventListener("change", renderHotels);
  maxPrice.addEventListener("input", updateAndRender);
  updateAndRender();
}

function renderHotels() {
  const grid = document.getElementById("hotel-grid");
  const cityFilter = document.getElementById("hotel-city-filter");
  const maxPrice = document.getElementById("hotel-max-price");
  const selectedCity = cityFilter ? cityFilter.value : "Todas";
  const selectedMaxPrice = maxPrice ? Number(maxPrice.value) : 100;

  const filteredHotels = hotels.filter((hotel) => {
    const cityMatch = selectedCity === "Todas" || hotel.city === selectedCity;
    return cityMatch && hotel.priceUsd <= selectedMaxPrice;
  });

  grid.innerHTML = "";

  if (!filteredHotels.length) {
    grid.innerHTML = `
              <div class="col-span-full panel-glass border border-white/80 rounded-3xl p-8 text-center">
                  <p class="font-bold text-gray-600">No hay hoteles con ese filtro. Sube el máximo o cambia la ciudad.</p>
              </div>
          `;
    return;
  }

  filteredHotels.forEach((h) => {
    const mapUrl = normalizeMapsUrl(h.maps);
    grid.innerHTML += `
              <div class="panel-glass rounded-[40px] border border-white/80 shadow-sm overflow-hidden group hover:shadow-xl transition-all">
                  <div class="h-56 overflow-hidden relative">
                      <img loading="lazy" src="${h.img}" alt="${h.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
                      <div class="absolute top-4 left-4 bg-white/90 px-3 py-1 rounded-full text-japan-wave font-bold text-xs shadow">${h.area}</div>
                      <div class="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-4 py-2 rounded-full text-japan-red font-black text-sm shadow-md">${formatUsd(h.priceUsd)} / noche</div>
                  </div>
                  <div class="p-8">
                      <span class="text-xs font-black text-gray-400 uppercase tracking-[0.2em] block mb-2">${h.city}</span>
                      <h4 class="text-2xl font-black text-ink mb-4">${h.name}</h4>
                      <p class="text-[15px] text-gray-600 leading-relaxed font-medium mb-8 min-h-[80px]">${h.desc}</p>
                      <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="block w-full text-center bg-ink text-white font-bold py-4 rounded-2xl hover:bg-japan-red transition-all shadow-md">VER EN GOOGLE MAPS</a>
                  </div>
              </div>
          `;
  });
}

function renderBudget() {
  const rows = document.getElementById("budget-rows");
  rows.innerHTML = "";
  let personTotal = 0;
  let tripTotal = 0;
  const personValues = [];

  budgetItems.forEach((b) => {
    const itemPersonUsd = b.shareable ? b.usd / TRAVELERS : b.usd;
    const itemTripUsd = b.shareable ? b.usd : b.usd * TRAVELERS;
    const splitLabel = b.shareable ? `Compartido entre ${TRAVELERS}` : "Gasto individual";

    personTotal += itemPersonUsd;
    tripTotal += itemTripUsd;
    personValues.push(itemPersonUsd);

    rows.innerHTML += `
              <div class="flex justify-between items-center group py-2 border-b border-gray-50 last:border-0">
                  <div>
                      <span class="block font-bold text-ink text-lg">${b.cat}</span>
                      <span class="text-[11px] text-gray-400 uppercase font-black tracking-widest mt-1">${splitLabel}</span>
                  </div>
                  <div class="text-right">
                      <span class="block font-black text-ink text-2xl group-hover:text-japan-red transition-colors">${formatUsd(itemPersonUsd)}</span>
                      <span class="block text-xs text-gray-500 font-bold mt-1">Tu parte</span>
                      <span class="block text-xs text-gray-400 font-bold mt-1">Total rubro: ${formatUsd(itemTripUsd)}</span>
                  </div>
              </div>
          `;
  });

  const personTotalUsd = formatUsd(personTotal);
  const personTotalJpy = formatJpy(personTotal * exchangeRate);
  const tripTotalJpy = formatJpy(tripTotal * exchangeRate);
  document.getElementById("total-usd").innerText = personTotalUsd;
  document.getElementById("total-jpy").innerText = tripTotalJpy;
  document.getElementById("summary-total-usd").innerText = personTotalUsd;
  document.getElementById("summary-total-jpy").innerText = personTotalJpy;

  const [tripMinJpy, tripMaxJpy] = cashPlan.personTripRangeJpy;
  const [dailyMinJpy, dailyMaxJpy] = cashPlan.dailyCarryRangeJpy;
  const tripMinUsd = tripMinJpy / exchangeRate;
  const tripMaxUsd = tripMaxJpy / exchangeRate;
  const dailyMinUsd = dailyMinJpy / exchangeRate;
  const dailyMaxUsd = dailyMaxJpy / exchangeRate;
  const emergencyUsd = cashPlan.emergencyJpy / exchangeRate;

  const cashCard = document.getElementById("cash-plan-card");
  cashCard.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.2em] text-japan-wave mb-2">Pagos y Efectivo</p>
                <h4 class="text-2xl font-black text-ink mb-2">Efectivo recomendado por persona</h4>
                <p class="text-sm text-gray-500">Estimación para 14 días con pago mixto (tarjeta + efectivo).</p>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-[280px]">
                <div class="bg-white rounded-2xl p-3 border border-gray-200">
                  <p class="text-[11px] font-black text-gray-400 uppercase tracking-widest">Total efectivo</p>
                  <p class="text-lg font-black text-japan-red">¥${tripMinJpy.toLocaleString()} - ¥${tripMaxJpy.toLocaleString()}</p>
                  <p class="text-xs text-gray-500">${formatUsd(tripMinUsd)} - ${formatUsd(tripMaxUsd)}</p>
                </div>
                <div class="bg-white rounded-2xl p-3 border border-gray-200">
                  <p class="text-[11px] font-black text-gray-400 uppercase tracking-widest">Carry diario</p>
                  <p class="text-lg font-black text-ink">¥${dailyMinJpy.toLocaleString()} - ¥${dailyMaxJpy.toLocaleString()}</p>
                  <p class="text-xs text-gray-500">${formatUsd(dailyMinUsd)} - ${formatUsd(dailyMaxUsd)}</p>
                </div>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200/70">
              <p class="text-sm font-bold text-gray-600 mb-2">Atentos con efectivo (alta probabilidad de no tarjeta):</p>
              <ul class="space-y-1 text-sm text-gray-600 list-disc pl-5">
                ${cashPlan.criticalCashPoints.map((item) => `<li>${item}</li>`).join("")}
              </ul>
              <p class="text-sm font-bold text-gray-600 mt-4 mb-2">Puntos críticos en tu itinerario:</p>
              <ul class="space-y-1 text-sm text-gray-600 list-disc pl-5">
                ${cashPlan.criticalByDay.map((item) => `<li>${item}</li>`).join("")}
              </ul>
              <p class="text-xs text-gray-500 mt-3">Reserva sugerida: ¥${cashPlan.emergencyJpy.toLocaleString()} (${formatUsd(emergencyUsd)}) para emergencias o fallo de terminal.</p>
            </div>
          `;

  const ctx = document.getElementById("budgetChart").getContext("2d");
  if (budgetChartInstance) {
    budgetChartInstance.destroy();
  }
  budgetChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: budgetItems.map((x) => x.cat),
      datasets: [
        {
          data: personValues,
          backgroundColor: ["#BC002D", "#0E4A67", "#1A1A1A", "#D98C00", "#16A085", "#5B6C8A"],
          borderWidth: 8,
          borderColor: "#ffffff",
          hoverOffset: 20,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      cutout: "75%",
    },
  });
}

function formatUsdReference(price) {
  if (Array.isArray(price.usdFromJpy) && price.usdFromJpy.length) {
    const values = price.usdFromJpy.map((yenValue) => formatUsd(yenValue / exchangeRate));
    if (price.usdMode === "range") return `${values[0]} - ${values[values.length - 1]}`;
    if (price.usdMode === "or") return values.join(" o ");
    return values.join(" · ");
  }
  return price.usd || "Variable";
}

function renderSafetyResearch() {
  if (!safetyResearch) return;

  const updatedEl = document.getElementById("safety-updated");
  if (!updatedEl) return;
  updatedEl.innerText = `Actualizado: ${safetyResearch.updatedAt}`;

  const riskZonesEl = document.getElementById("safety-risk-zones");
  riskZonesEl.innerHTML = safetyResearch.highRiskZones.map((zone) => `<span class="risk-chip">${zone}</span>`).join("");

  const commonScamsEl = document.getElementById("safety-common-scams");
  commonScamsEl.innerHTML = safetyResearch.commonScams
    .map((item) => `<li class="safety-list-item">${item}</li>`)
    .join("");

  const tipsEl = document.getElementById("safety-tips-list");
  tipsEl.innerHTML = safetyResearch.antiScamTips.map((tip) => `<li class="safety-list-item">${tip}</li>`).join("");

  const moneyEl = document.getElementById("money-safety-list");
  moneyEl.innerHTML = safetyResearch.moneySafety.map((tip) => `<li class="safety-list-item">${tip}</li>`).join("");

  if (travelReadiness) {
    const mustPackEl = document.getElementById("must-pack-list");
    if (mustPackEl) {
      mustPackEl.innerHTML = travelReadiness.mustPack.map((item) => `<li class="safety-list-item">${item}</li>`).join("");
    }

    const watchOutEl = document.getElementById("watchout-list");
    if (watchOutEl) {
      watchOutEl.innerHTML = travelReadiness.watchOutGeneral
        .map((item) => `<li class="safety-list-item">${item}</li>`)
        .join("");
    }

    const itineraryAttentionEl = document.getElementById("itinerary-attention-list");
    if (itineraryAttentionEl) {
      itineraryAttentionEl.innerHTML = travelReadiness.itineraryAttentionByDay
        .map((item) => `<li class="safety-list-item">${item}</li>`)
        .join("");
    }
  }

  const contactsEl = document.getElementById("emergency-contacts");
  contactsEl.innerHTML = safetyResearch.emergencyContacts
    .map(
      (contact) => `
      <div class="emergency-card">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.16em] text-gray-400">${contact.title}</p>
          <p class="text-xs text-gray-500 mt-1">${contact.note}</p>
        </div>
        <p class="text-2xl font-black text-japan-red leading-none">${contact.value}</p>
      </div>
    `,
    )
    .join("");

  const priceGrid = document.getElementById("price-reference-grid");
  priceGrid.innerHTML = safetyResearch.realisticPrices
    .map(
      (price) => `
      <article class="price-ref-card">
        <p class="text-[11px] font-black uppercase tracking-[0.16em] text-japan-wave mb-2">${price.category}</p>
        <h4 class="text-xl font-black text-ink mb-3">${price.item}</h4>
        <p class="text-lg font-black text-japan-red leading-snug">${price.yen}</p>
        <p class="text-xs font-bold text-gray-400 mt-1">${formatUsdReference(price)}</p>
        <p class="text-sm text-gray-600 mt-3">${price.note}</p>
      </article>
    `,
    )
    .join("");

  const extraCostsEl = document.getElementById("extra-cost-alerts");
  extraCostsEl.innerHTML = safetyResearch.extraCostAlerts
    .map(
      (alert) => `
      <div class="extra-cost-card">
        <p class="font-black text-ink">${alert.title}</p>
        <p class="text-sm text-gray-600 mt-1">${alert.detail}</p>
        <p class="text-xs font-bold text-gray-500 mt-2">${alert.impact}</p>
      </div>
    `,
    )
    .join("");

  const benchmarkEl = document.getElementById("spend-benchmark");
  const benchmarkMinUsd = formatUsd(227000 / exchangeRate);
  const benchmarkMaxUsd = formatUsd(229000 / exchangeRate);
  benchmarkEl.innerHTML = `
    <div class="extra-cost-card">
      <p class="font-black text-ink">${safetyResearch.spendBenchmark.title}</p>
      <p class="text-sm text-gray-600 mt-1">${safetyResearch.spendBenchmark.detail}</p>
      <p class="text-xs font-bold text-japan-red mt-2">Equivalente aprox: ${benchmarkMinUsd} - ${benchmarkMaxUsd}</p>
      <p class="text-xs font-bold text-gray-500 mt-2">${safetyResearch.spendBenchmark.note}</p>
    </div>
  `;

  const sourcesEl = document.getElementById("safety-sources");
  sourcesEl.innerHTML = safetyResearch.sources
    .map(
      (source) => `
      <a href="${source.url}" target="_blank" rel="noopener noreferrer" class="source-link-card">
        <span>${source.label}</span>
        <span aria-hidden="true">↗</span>
      </a>
    `,
    )
    .join("");
}

window.onload = () => {
  updateTripCountdown();
  hydrateExchangeRateControls();
  renderSelectors();
  renderSafetyResearch();
  hydrateHotelFilters();
  renderItinerary();
  renderBudget();
};
