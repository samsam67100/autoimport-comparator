// pages/api/search.js
// Scrapers utilisés :
// - 🇫🇷 scrapifier/leboncoin-universal-scraper
// - 🇩🇪 3x1t/mobile-de-scraper

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData } = req.body;

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    console.log('⚠️ Pas de token Apify - Mode démo');
    return res.status(200).json(getDemoData(brand, model, city));
  }

  try {
    // Lancer les deux recherches en parallèle
    const [deResults, frResults] = await Promise.all([
      searchMobileDe(APIFY_TOKEN, { brand, model, yearMin, yearMax, kmMax, fuel, priceMax }),
      searchLeboncoin(APIFY_TOKEN, { brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData })
    ]);

    return res.status(200).json({
      de: deResults,
      fr: frResults
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    return res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
}

// ========================================
// 🇩🇪 MOBILE.DE
// ========================================

async function searchMobileDe(token, params) {
  const { brand, model, yearMin, yearMax, kmMax, fuel, priceMax } = params;

  // Construire l'URL au format qui fonctionne
  const brandCode = getMobileDeCode(brand);
  const searchText = encodeURIComponent(`${brand} ${model}`);
  
  // Format URL mobile.de
  const urlParams = new URLSearchParams({
    dam: 'false',
    isSearchRequest: 'true',
    od: 'up',
    ref: 'srp',
    s: 'Car',
    sb: 'rel',
    vc: 'Car'
  });

  // Prix max (format :15000)
  if (priceMax) {
    urlParams.append('p', `:${priceMax}`);
  }

  // Kilométrage max (format :100000)
  if (kmMax) {
    urlParams.append('ml', `:${kmMax}`);
  }

  // Année min-max (format fr:2018:2024)
  if (yearMin || yearMax) {
    urlParams.append('fr', `${yearMin || ''}:${yearMax || ''}`);
  }

  // Marque et modèle (format ms=CODE;;)
  if (brandCode) {
    urlParams.append('ms', `${brandCode};;`);
  }

  // Ajouter recherche texte pour le modèle
  if (model) {
    urlParams.append('makeModelVariant1.searchInFreetext', model);
  }

  // Carburant
  if (fuel && fuel !== 'Tous') {
    const fuelCode = { 'Diesel': 'D', 'Essence': 'B', 'Hybride': 'H', 'Électrique': 'E' }[fuel];
    if (fuelCode) urlParams.append('ft', fuelCode);
  }

  const searchUrl = `https://suchen.mobile.de/fahrzeuge/search.html?${urlParams.toString()}`;
  console.log('🇩🇪 URL mobile.de:', searchUrl);

  try {
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/3x1t~mobile-de-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: searchUrl }],
          maxItems: 15
        })
      }
    );

    if (!runResponse.ok) {
      console.error('Erreur mobile.de:', await runResponse.text());
      return [];
    }

    const runData = await runResponse.json();
    const results = await waitForResults(token, runData.data.id);

    return parseResults(results, 'mobile.de');

  } catch (error) {
    console.error('Erreur mobile.de:', error);
    return [];
  }
}

// ========================================
// 🇫🇷 LEBONCOIN
// ========================================

async function searchLeboncoin(token, params) {
  const { brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData } = params;

  // Format URL leboncoin (testé et validé)
  const searchText = encodeURIComponent(`${brand} ${model}`);
  
  const urlParams = new URLSearchParams({
    category: '2',  // Voitures
    text: `${brand} ${model}`
  });

  // Prix max (format price=-10000 ou price=min-max)
  if (priceMax) {
    urlParams.append('price', `-${priceMax}`);
  }

  // Kilométrage max
  if (kmMax) {
    urlParams.append('mileage', `-${kmMax}`);
  }

  // Année (format regdate=min-max)
  if (yearMin || yearMax) {
    urlParams.append('regdate', `${yearMin || ''}-${yearMax || ''}`);
  }

  // Carburant
  if (fuel && fuel !== 'Tous') {
    const fuelCode = { 'Diesel': '2', 'Essence': '1', 'Hybride': '3', 'Électrique': '4' }[fuel];
    if (fuelCode) urlParams.append('fuel', fuelCode);
  }

  // Localisation (ville + rayon)
  if (cityData && cityData.lat && cityData.lng && distance > 0) {
    urlParams.append('lat', cityData.lat.toFixed(5));
    urlParams.append('lng', cityData.lng.toFixed(5));
    urlParams.append('radius', (distance * 1000).toString()); // en mètres
  }

  const searchUrl = `https://www.leboncoin.fr/recherche?${urlParams.toString()}`;
  console.log('🇫🇷 URL leboncoin:', searchUrl);

  try {
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/scrapifier~leboncoin-universal-scraper/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: searchUrl }],
          maxItems: 15
        })
      }
    );

    if (!runResponse.ok) {
      console.error('Erreur leboncoin:', await runResponse.text());
      return [];
    }

    const runData = await runResponse.json();
    const results = await waitForResults(token, runData.data.id);

    return parseResults(results, 'leboncoin');

  } catch (error) {
    console.error('Erreur leboncoin:', error);
    return [];
  }
}

// ========================================
// ATTENDRE LES RÉSULTATS
// ========================================

async function waitForResults(token, runId, maxWait = 90000) {
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const response = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
    );
    const data = await response.json();
    const status = data.data.status;

    console.log(`⏳ Run ${runId.slice(0, 8)}...: ${status}`);

    if (status === 'SUCCEEDED') {
      const datasetId = data.data.defaultDatasetId;
      const itemsResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`
      );
      const items = await itemsResponse.json();
      console.log(`✅ ${items.length} résultats trouvés`);
      return items;
    }

    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      console.error(`❌ Run échoué: ${status}`);
      return [];
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  console.error('❌ Timeout');
  return [];
}

// ========================================
// PARSER LES RÉSULTATS
// ========================================

function parseResults(items, source) {
  return items.map(item => {
    // Extraire le prix (nettoyer les caractères)
    let price = 0;
    if (item.price) {
      price = parseInt(String(item.price).replace(/[^0-9]/g, '')) || 0;
    }

    // Extraire le kilométrage
    let km = 0;
    if (item.mileage || item.km || item.attributes?.mileage) {
      const kmStr = item.mileage || item.km || item.attributes?.mileage || '0';
      km = parseInt(String(kmStr).replace(/[^0-9]/g, '')) || 0;
    }

    // Extraire l'année
    let year = 0;
    if (item.year || item.firstRegistration || item.regdate || item.attributes?.regdate) {
      const yearStr = item.year || item.firstRegistration || item.regdate || item.attributes?.regdate || '';
      const match = String(yearStr).match(/20\d{2}|19\d{2}/);
      year = match ? parseInt(match[0]) : 0;
    }

    return {
      id: item.id || Math.random().toString(36).substr(2, 9),
      title: item.title || item.name || 'Véhicule',
      price: price,
      year: year,
      km: km,
      fuel: item.fuel || item.fuelType || item.attributes?.fuel || 'N/A',
      url: item.url || item.link || (source === 'mobile.de' ? 'https://www.mobile.de' : 'https://www.leboncoin.fr'),
      city: item.location || item.city || item.attributes?.location || (source === 'mobile.de' ? 'Allemagne' : 'France')
    };
  }).filter(car => car.price > 0);
}

// ========================================
// CODES MARQUES MOBILE.DE
// ========================================

function getMobileDeCode(brand) {
  const codes = {
    'Renault': '20700',
    'Peugeot': '19300',
    'Citroën': '6500',
    'Volkswagen': '25100',
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
    'Skoda': '22900',
    'Seat': '22000',
    'Dacia': '6600',
    'Volvo': '25200',
    'Porsche': '19000',
    'Mini': '17500'
  };
  return codes[brand] || '';
}

// ========================================
// DONNÉES DÉMO (FALLBACK)
// ========================================

function getDemoData(brand, model, city) {
  return {
    de: [
      { id: 'de1', title: `${brand} ${model}`, year: 2019, km: 78000, fuel: 'Diesel', price: 3200, city: 'Berlin', url: 'https://www.mobile.de' },
      { id: 'de2', title: `${brand} ${model}`, year: 2020, km: 65000, fuel: 'Diesel', price: 4100, city: 'Munich', url: 'https://www.mobile.de' },
      { id: 'de3', title: `${brand} ${model}`, year: 2018, km: 92000, fuel: 'Diesel', price: 2800, city: 'Hamburg', url: 'https://www.mobile.de' },
    ],
    fr: [
      { id: 'fr1', title: `${brand} ${model}`, year: 2019, km: 82000, fuel: 'Diesel', price: 5900, city: city || 'Paris', url: 'https://www.leboncoin.fr' },
      { id: 'fr2', title: `${brand} ${model}`, year: 2020, km: 71000, fuel: 'Diesel', price: 6800, city: city || 'Lyon', url: 'https://www.leboncoin.fr' },
      { id: 'fr3', title: `${brand} ${model}`, year: 2018, km: 88000, fuel: 'Diesel', price: 5200, city: city || 'Marseille', url: 'https://www.leboncoin.fr' },
    ]
  };
}
