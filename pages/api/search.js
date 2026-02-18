// pages/api/search.js
// Utilise les scrapers spécialisés :
// - 🇫🇷 scrapifier/leboncoin-universal-scraper
// - 🇩🇪 3x1t/mobile-de-scraper

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData } = req.body;

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  // Si pas de token, utilise des données de démo
  if (!APIFY_TOKEN) {
    console.log('⚠️ Pas de token Apify - Mode démo activé');
    return res.status(200).json(getDemoData(brand, model, city, distance));
  }

  try {
    // Lancer les deux recherches en parallèle
    const [mobileDeResults, leboncoinResults] = await Promise.all([
      searchMobileDe(APIFY_TOKEN, { brand, model, yearMin, yearMax, kmMax, fuel, priceMax }),
      searchLeboncoin(APIFY_TOKEN, { brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData })
    ]);

    return res.status(200).json({
      de: mobileDeResults,
      fr: leboncoinResults
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    return res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
}

// ========================================
// 🇩🇪 MOBILE.DE SCRAPER (3x1t/mobile-de-scraper)
// ========================================

async function searchMobileDe(token, params) {
  const { brand, model, yearMin, yearMax, kmMax, fuel, priceMax } = params;

  // Construire l'URL de recherche mobile.de
  const searchUrl = buildMobileDeUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax });

  console.log('🇩🇪 Lancement scraper mobile.de:', searchUrl);

  try {
    // Lancer l'actor
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/3x1t~mobile-de-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: searchUrl }],
          maxItems: 20,
          proxyConfiguration: {
            useApifyProxy: true
          }
        })
      }
    );

    if (!runResponse.ok) {
      console.error('Erreur lancement mobile.de:', await runResponse.text());
      return [];
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;

    // Attendre que le run soit terminé
    const results = await waitForResults(token, runId);

    // Parser les résultats
    return results.map(item => ({
      id: item.id || Math.random().toString(36).substr(2, 9),
      title: item.title || item.name || `${brand} ${model}`,
      price: parseInt(String(item.price).replace(/[^0-9]/g, '')) || 0,
      year: parseInt(item.year || item.firstRegistration) || 2020,
      km: parseInt(String(item.mileage || item.km || '0').replace(/[^0-9]/g, '')) || 0,
      fuel: item.fuel || item.fuelType || 'N/A',
      url: item.url || item.link || 'https://www.mobile.de',
      city: item.location || item.city || 'Allemagne'
    })).filter(car => car.price > 0);

  } catch (error) {
    console.error('Erreur mobile.de:', error);
    return [];
  }
}

// ========================================
// 🇫🇷 LEBONCOIN SCRAPER (scrapifier/leboncoin-universal-scraper)
// ========================================

async function searchLeboncoin(token, params) {
  const { brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData } = params;

  // Construire l'URL de recherche leboncoin avec localisation
  const searchUrl = buildLeboncoinUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData });

  console.log('🇫🇷 Lancement scraper leboncoin:', searchUrl);

  try {
    // Lancer l'actor
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/scrapifier~leboncoin-universal-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: searchUrl }],
          maxItems: 20,
          proxyConfiguration: {
            useApifyProxy: true
          }
        })
      }
    );

    if (!runResponse.ok) {
      console.error('Erreur lancement leboncoin:', await runResponse.text());
      return [];
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;

    // Attendre que le run soit terminé
    const results = await waitForResults(token, runId);

    // Parser les résultats
    return results.map(item => ({
      id: item.id || Math.random().toString(36).substr(2, 9),
      title: item.title || item.name || `${brand} ${model}`,
      price: parseInt(String(item.price).replace(/[^0-9]/g, '')) || 0,
      year: parseInt(item.year || item.regdate || item.attributes?.regdate) || 2020,
      km: parseInt(String(item.mileage || item.km || item.attributes?.mileage || '0').replace(/[^0-9]/g, '')) || 0,
      fuel: item.fuel || item.attributes?.fuel || 'N/A',
      url: item.url || item.link || 'https://www.leboncoin.fr',
      city: item.location || item.city || item.attributes?.city || city
    })).filter(car => car.price > 0);

  } catch (error) {
    console.error('Erreur leboncoin:', error);
    return [];
  }
}

// ========================================
// ATTENDRE LES RÉSULTATS D'UN RUN
// ========================================

async function waitForResults(token, runId, maxWaitTime = 60000) {
  const startTime = Date.now();
  const pollInterval = 3000; // 3 secondes

  while (Date.now() - startTime < maxWaitTime) {
    // Vérifier le statut du run
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
    );
    const statusData = await statusResponse.json();
    const status = statusData.data.status;

    console.log(`⏳ Run ${runId}: ${status}`);

    if (status === 'SUCCEEDED') {
      // Récupérer les résultats du dataset
      const datasetId = statusData.data.defaultDatasetId;
      const dataResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`
      );
      const items = await dataResponse.json();
      console.log(`✅ Run terminé: ${items.length} résultats`);
      return items;
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      console.error(`❌ Run échoué: ${status}`);
      return [];
    }

    // Attendre avant de re-vérifier
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  console.error('❌ Timeout: le run prend trop de temps');
  return [];
}

// ========================================
// CONSTRUIRE L'URL MOBILE.DE (NATIONALE)
// ========================================

function buildMobileDeUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax }) {
  const baseUrl = 'https://suchen.mobile.de/fahrzeuge/search.html';
  
  const params = new URLSearchParams({
    damageUnrepaired: 'NO_DAMAGE_UNREPAIRED',
    isSearchRequest: 'true',
    maxMileage: kmMax.toString(),
    maxPrice: priceMax.toString(),
    minFirstRegistrationDate: `${yearMin}-01-01`,
    maxFirstRegistrationDate: `${yearMax}-12-31`,
    scopeId: 'C',
    sfmr: 'false',
    sortOption: 'sortby:price'
  });

  // Ajouter le carburant
  if (fuel && fuel !== 'Tous') {
    const fuelMap = { 'Diesel': 'D', 'Essence': 'B', 'Hybride': 'H', 'Électrique': 'E' };
    if (fuelMap[fuel]) params.append('ft', fuelMap[fuel]);
  }

  // Ajouter la marque
  const brandId = getBrandIdMobileDe(brand);
  if (brandId) params.append('makeModelVariant1.makeId', brandId);

  // Ajouter le modèle dans le texte de recherche
  if (model) params.append('makeModelVariant1.searchInFreetext', model);

  return `${baseUrl}?${params.toString()}`;
}

// ========================================
// CONSTRUIRE L'URL LEBONCOIN (LOCALE)
// ========================================

function buildLeboncoinUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData }) {
  const baseUrl = 'https://www.leboncoin.fr/recherche';
  
  const searchText = `${brand} ${model}`.trim();
  
  const params = new URLSearchParams({
    category: '2',
    text: searchText,
    mileage_max: kmMax.toString(),
    price_max: priceMax.toString(),
    regdate_min: yearMin.toString(),
    regdate_max: yearMax.toString(),
    sort: 'price',
    order: 'asc'
  });

  // Ajouter le carburant
  if (fuel && fuel !== 'Tous') {
    const fuelMap = { 'Diesel': 'diesel', 'Essence': 'essence', 'Hybride': 'hybrid', 'Électrique': 'electric' };
    if (fuelMap[fuel]) params.append('fuel', fuelMap[fuel]);
  }

  // Localisation
  if (cityData) {
    // Utiliser les coordonnées pour la recherche locale
    if (cityData.lat && cityData.lng) {
      params.append('lat', cityData.lat.toString());
      params.append('lng', cityData.lng.toString());
      params.append('radius', (distance * 1000).toString());
    }
  }

  return `${baseUrl}?${params.toString()}`;
}

// ========================================
// MAPPING MARQUES MOBILE.DE
// ========================================

function getBrandIdMobileDe(brand) {
  const brandIds = {
    'Renault': '20200',
    'Peugeot': '19000',
    'Citroën': '5900',
    'Volkswagen': '25200',
    'BMW': '3500',
    'Mercedes': '17200',
    'Audi': '1900',
    'Ford': '9000',
    'Opel': '18700',
    'Fiat': '8800',
    'Toyota': '24100',
    'Nissan': '18100',
    'Hyundai': '11000',
    'Kia': '12100',
    'Skoda': '22500',
    'Seat': '22000',
    'Dacia': '6600',
    'Volvo': '25100',
    'Porsche': '19300',
    'Mini': '17500'
  };
  return brandIds[brand] || '';
}

// ========================================
// DONNÉES DE DÉMONSTRATION (FALLBACK)
// ========================================

function getDemoData(brand, model, city, distance) {
  const germanCities = ['Berlin', 'Munich', 'Hamburg', 'Francfort', 'Stuttgart', 'Düsseldorf'];
  
  const nearbyFrenchCities = {
    'Strasbourg': ['Strasbourg', 'Colmar', 'Mulhouse', 'Haguenau'],
    'Paris': ['Paris', 'Versailles', 'Saint-Denis', 'Créteil'],
    'Lyon': ['Lyon', 'Villeurbanne', 'Vénissieux', 'Bron'],
    'Marseille': ['Marseille', 'Aix-en-Provence', 'Aubagne'],
  };

  const frCities = nearbyFrenchCities[city] || [city];

  return {
    de: [
      { id: 'de1', title: `${brand} ${model}`, year: 2019, km: 78000, fuel: 'Diesel', price: 3200, city: germanCities[0], url: 'https://www.mobile.de' },
      { id: 'de2', title: `${brand} ${model}`, year: 2020, km: 65000, fuel: 'Diesel', price: 4100, city: germanCities[1], url: 'https://www.mobile.de' },
      { id: 'de3', title: `${brand} ${model}`, year: 2018, km: 92000, fuel: 'Diesel', price: 2800, city: germanCities[2], url: 'https://www.mobile.de' },
    ],
    fr: [
      { id: 'fr1', title: `${brand} ${model}`, year: 2019, km: 82000, fuel: 'Diesel', price: 5900, city: frCities[0], url: 'https://www.leboncoin.fr' },
      { id: 'fr2', title: `${brand} ${model}`, year: 2020, km: 71000, fuel: 'Diesel', price: 6800, city: frCities[1] || frCities[0], url: 'https://www.leboncoin.fr' },
      { id: 'fr3', title: `${brand} ${model}`, year: 2018, km: 88000, fuel: 'Diesel', price: 5200, city: frCities[2] || frCities[0], url: 'https://www.leboncoin.fr' },
    ]
  };
}
