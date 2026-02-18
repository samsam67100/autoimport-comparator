// pages/api/search.js
// Recherche : 🇩🇪 Toute l'Allemagne vs 🇫🇷 Ville + rayon

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
    // ========================================
    // 🇩🇪 RECHERCHE MOBILE.DE - TOUTE L'ALLEMAGNE
    // ========================================
    
    const mobileDeUrl = buildMobileDeUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax });
    console.log('🇩🇪 Recherche mobile.de (nationale):', mobileDeUrl);

    const mobileDeResults = await callApifyScraper(APIFY_TOKEN, mobileDeUrl, 'mobile.de');

    // ========================================
    // 🇫🇷 RECHERCHE LEBONCOIN - VILLE + RAYON
    // ========================================
    
    const leboncoinUrl = buildLeboncoinUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData });
    console.log(`🇫🇷 Recherche leboncoin (${city} +${distance}km):`, leboncoinUrl);

    const leboncoinResults = await callApifyScraper(APIFY_TOKEN, leboncoinUrl, 'leboncoin');

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
    sortOption: 'sortby:price',
    searchId: Date.now().toString()
  });

  // Ajouter le carburant si spécifié
  if (fuel && fuel !== 'Tous') {
    const fuelMap = {
      'Diesel': 'D',
      'Essence': 'B',
      'Hybride': 'H',
      'Électrique': 'E'
    };
    if (fuelMap[fuel]) {
      params.append('ft', fuelMap[fuel]);
    }
  }

  // Ajouter la marque
  const brandId = getBrandIdMobileDe(brand);
  if (brandId) {
    params.append('makeModelVariant1.makeId', brandId);
  }

  // Note: PAS de paramètre de localisation = recherche nationale

  return `${baseUrl}?${params.toString()}`;
}

// ========================================
// CONSTRUIRE L'URL LEBONCOIN (LOCALE)
// ========================================

function buildLeboncoinUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData }) {
  const baseUrl = 'https://www.leboncoin.fr/recherche';
  
  const searchText = `${brand} ${model}`.trim();
  
  const params = new URLSearchParams({
    category: '2', // Catégorie voitures
    text: searchText,
    mileage_max: kmMax.toString(),
    price_max: priceMax.toString(),
    regdate_min: yearMin.toString(),
    regdate_max: yearMax.toString(),
    sort: 'price',
    order: 'asc'
  });

  // Ajouter le carburant si spécifié
  if (fuel && fuel !== 'Tous') {
    const fuelMap = {
      'Diesel': 'diesel',
      'Essence': 'essence', 
      'Hybride': 'hybrid',
      'Électrique': 'electric'
    };
    if (fuelMap[fuel]) {
      params.append('fuel', fuelMap[fuel]);
    }
  }

  // === LOCALISATION FRANÇAISE ===
  // Ajouter les coordonnées de la ville
  if (cityData && cityData.lat && cityData.lng) {
    params.append('lat', cityData.lat.toString());
    params.append('lng', cityData.lng.toString());
    params.append('radius', (distance * 1000).toString()); // Leboncoin utilise les mètres
  }

  // Alternative : utiliser le code postal pour certaines villes
  if (cityData && cityData.postalCode) {
    params.append('locations', cityData.postalCode);
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
// APPELER LE SCRAPER APIFY
// ========================================

async function callApifyScraper(token, url, source) {
  const actorId = 'apify~web-scraper';
  
  const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrls: [{ url }],
      maxPagesPerCrawl: 1,
      pageFunction: getPageFunction(source)
    })
  });

  if (!response.ok) {
    throw new Error(`Apify error: ${response.status}`);
  }

  const runData = await response.json();
  
  // Attendre les résultats
  await new Promise(resolve => setTimeout(resolve, 10000));

  const datasetResponse = await fetch(
    `https://api.apify.com/v2/datasets/${runData.data.defaultDatasetId}/items?token=${token}`
  );
  
  const items = await datasetResponse.json();
  
  return items.map(item => ({
    id: item.id || Math.random().toString(36).substr(2, 9),
    title: item.title || `${item.brand} ${item.model}`,
    price: parseInt(item.price) || 0,
    year: parseInt(item.year) || 2020,
    km: parseInt(item.mileage || item.km) || 50000,
    fuel: item.fuel || 'Diesel',
    url: item.url || url,
    city: item.city || item.location || 'N/A'
  }));
}

// ========================================
// FONCTIONS DE SCRAPING
// ========================================

function getPageFunction(source) {
  if (source === 'mobile.de') {
    return `
      async function pageFunction(context) {
        const { $, request } = context;
        const results = [];
        
        $('[data-testid="result-listing-entry"]').each((i, el) => {
          results.push({
            title: $(el).find('h2').text().trim(),
            price: $(el).find('[data-testid="price"]').text().replace(/[^0-9]/g, ''),
            year: $(el).find('[data-testid="first-registration"]').text().match(/\\d{4}/)?.[0],
            mileage: $(el).find('[data-testid="mileage"]').text().replace(/[^0-9]/g, ''),
            fuel: $(el).find('[data-testid="fuel-type"]').text().trim(),
            url: $(el).find('a').attr('href'),
            city: $(el).find('[data-testid="location"]').text().trim()
          });
        });
        
        return results;
      }
    `;
  }
  
  return `
    async function pageFunction(context) {
      const { $, request } = context;
      const results = [];
      
      $('[data-qa-id="aditem_container"]').each((i, el) => {
        results.push({
          title: $(el).find('[data-qa-id="aditem_title"]').text().trim(),
          price: $(el).find('[data-qa-id="aditem_price"]').text().replace(/[^0-9]/g, ''),
          url: 'https://www.leboncoin.fr' + $(el).find('a').attr('href'),
          city: $(el).find('[data-qa-id="aditem_location"]').text().trim()
        });
      });
      
      return results;
    }
  `;
}

// ========================================
// DONNÉES DE DÉMONSTRATION
// ========================================

function getDemoData(brand, model, city, distance) {
  // Villes allemandes pour la démo (recherche nationale)
  const germanCities = ['Berlin', 'Munich', 'Hamburg', 'Francfort', 'Stuttgart', 'Düsseldorf', 'Cologne', 'Leipzig'];
  
  // Villes françaises autour de la ville sélectionnée (simulé)
  const nearbyFrenchCities = {
    'Strasbourg': ['Strasbourg', 'Colmar', 'Mulhouse', 'Haguenau', 'Sélestat'],
    'Paris': ['Paris', 'Versailles', 'Saint-Denis', 'Créteil', 'Nanterre'],
    'Lyon': ['Lyon', 'Villeurbanne', 'Vénissieux', 'Saint-Étienne', 'Bron'],
    'Marseille': ['Marseille', 'Aix-en-Provence', 'Aubagne', 'Martigues', 'Salon-de-Provence'],
    'Toulouse': ['Toulouse', 'Blagnac', 'Colomiers', 'Tournefeuille', 'Muret'],
    'Bordeaux': ['Bordeaux', 'Mérignac', 'Pessac', 'Talence', 'Libourne'],
    'Lille': ['Lille', 'Roubaix', 'Tourcoing', 'Villeneuve-d\'Ascq', 'Dunkerque'],
    'Nice': ['Nice', 'Cannes', 'Antibes', 'Grasse', 'Menton'],
    'Nantes': ['Nantes', 'Saint-Nazaire', 'Saint-Herblain', 'Rezé', 'La Roche-sur-Yon'],
    'Montpellier': ['Montpellier', 'Nîmes', 'Béziers', 'Sète', 'Lunel']
  };

  const frCities = nearbyFrenchCities[city] || [city, 'Ville proche 1', 'Ville proche 2'];

  return {
    de: [
      { 
        id: 'de1', 
        title: `${brand} ${model}`, 
        year: 2019, 
        km: 78000, 
        fuel: 'Diesel', 
        price: 3200, 
        city: germanCities[Math.floor(Math.random() * germanCities.length)],
        url: 'https://www.mobile.de' 
      },
      { 
        id: 'de2', 
        title: `${brand} ${model}`, 
        year: 2020, 
        km: 65000, 
        fuel: 'Diesel', 
        price: 4100, 
        city: germanCities[Math.floor(Math.random() * germanCities.length)],
        url: 'https://www.mobile.de' 
      },
      { 
        id: 'de3', 
        title: `${brand} ${model}`, 
        year: 2018, 
        km: 92000, 
        fuel: 'Diesel', 
        price: 2800, 
        city: germanCities[Math.floor(Math.random() * germanCities.length)],
        url: 'https://www.mobile.de' 
      },
      { 
        id: 'de4', 
        title: `${brand} ${model}`, 
        year: 2021, 
        km: 45000, 
        fuel: 'Diesel', 
        price: 5200, 
        city: germanCities[Math.floor(Math.random() * germanCities.length)],
        url: 'https://www.mobile.de' 
      },
    ],
    fr: [
      { 
        id: 'fr1', 
        title: `${brand} ${model}`, 
        year: 2019, 
        km: 82000, 
        fuel: 'Diesel', 
        price: 5900, 
        city: frCities[0],
        url: 'https://www.leboncoin.fr' 
      },
      { 
        id: 'fr2', 
        title: `${brand} ${model}`, 
        year: 2020, 
        km: 71000, 
        fuel: 'Diesel', 
        price: 6800, 
        city: frCities[1] || frCities[0],
        url: 'https://www.leboncoin.fr' 
      },
      { 
        id: 'fr3', 
        title: `${brand} ${model}`, 
        year: 2018, 
        km: 88000, 
        fuel: 'Diesel', 
        price: 5200, 
        city: frCities[2] || frCities[0],
        url: 'https://www.leboncoin.fr' 
      },
    ]
  };
}
