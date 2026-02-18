// pages/api/search.js
// Cette API est appelée quand l'utilisateur clique sur "Comparer"

export default async function handler(req, res) {
  // Vérifie que c'est une requête POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { brand, model, yearMin, yearMax, kmMax, fuel, priceMax } = req.body;

  // Récupère le token Apify depuis les variables d'environnement
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  // Si pas de token, utilise des données de démo
  if (!APIFY_TOKEN) {
    console.log('⚠️ Pas de token Apify - Mode démo activé');
    return res.status(200).json(getDemoData(brand, model));
  }

  try {
    // ========================================
    // RECHERCHE SUR MOBILE.DE (Allemagne)
    // ========================================
    
    // Construire l'URL de recherche mobile.de
    const mobileDeUrl = buildMobileDeUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax });
    
    console.log('🇩🇪 Recherche mobile.de:', mobileDeUrl);

    // Appeler Apify pour scraper mobile.de
    const mobileDeResults = await callApifyScraper(APIFY_TOKEN, mobileDeUrl, 'mobile.de');

    // ========================================
    // RECHERCHE SUR LEBONCOIN (France)
    // ========================================
    
    // Construire l'URL de recherche leboncoin
    const leboncoinUrl = buildLeboncoinUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax });
    
    console.log('🇫🇷 Recherche leboncoin:', leboncoinUrl);

    // Appeler Apify pour scraper leboncoin
    const leboncoinResults = await callApifyScraper(APIFY_TOKEN, leboncoinUrl, 'leboncoin');

    // ========================================
    // RETOURNER LES RÉSULTATS
    // ========================================
    
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
// FONCTIONS UTILITAIRES
// ========================================

// Construire l'URL mobile.de
function buildMobileDeUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax }) {
  const params = new URLSearchParams({
    damageUnrepaired: 'NO_DAMAGE_UNREPAIRED',
    isSearchRequest: 'true',
    maxMileage: kmMax,
    maxPrice: priceMax,
    minFirstRegistrationDate: `${yearMin}-01-01`,
    maxFirstRegistrationDate: `${yearMax}-12-31`,
    scopeId: 'C', // Voitures
    sortOption: 'sortby:relevance'
  });

  // Ajouter la marque et le modèle
  if (brand) params.append('makeModelVariant1.makeId', getBrandIdMobileDe(brand));
  
  return `https://suchen.mobile.de/fahrzeuge/search.html?${params.toString()}`;
}

// Construire l'URL leboncoin
function buildLeboncoinUrl({ brand, model, yearMin, yearMax, kmMax, fuel, priceMax }) {
  const searchText = `${brand} ${model}`.trim();
  
  const params = new URLSearchParams({
    category: '2', // Voitures
    text: searchText,
    mileage_max: kmMax,
    price_max: priceMax,
    regdate_min: yearMin,
    regdate_max: yearMax
  });

  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
}

// Mapping des marques vers les IDs mobile.de
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
    'Seat': '22000'
  };
  return brandIds[brand] || '';
}

// Appeler le scraper Apify
async function callApifyScraper(token, url, source) {
  // Utilise l'Actor "apify/web-scraper" ou un actor spécifique
  const actorId = 'apify~web-scraper';
  
  const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrls: [{ url }],
      maxPagesPerCrawl: 1,
      // Configuration du scraper selon la source
      pageFunction: getPageFunction(source)
    })
  });

  if (!response.ok) {
    throw new Error(`Apify error: ${response.status}`);
  }

  const runData = await response.json();
  
  // Attendre que le run soit terminé et récupérer les résultats
  // Note: En production, tu voudrais utiliser un webhook ou polling
  await new Promise(resolve => setTimeout(resolve, 10000)); // Attente simplifiée

  // Récupérer les résultats du dataset
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

// Page function pour le scraper (à adapter selon le site)
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
  
  // leboncoin
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

function getDemoData(brand, model) {
  // Données fictives pour tester sans Apify
  return {
    de: [
      { 
        id: 'de1', 
        title: `${brand} ${model}`, 
        year: 2019, 
        km: 78000, 
        fuel: 'Diesel', 
        price: 3200, 
        city: 'Berlin', 
        url: 'https://www.mobile.de' 
      },
      { 
        id: 'de2', 
        title: `${brand} ${model}`, 
        year: 2020, 
        km: 65000, 
        fuel: 'Diesel', 
        price: 4100, 
        city: 'Munich', 
        url: 'https://www.mobile.de' 
      },
      { 
        id: 'de3', 
        title: `${brand} ${model}`, 
        year: 2018, 
        km: 92000, 
        fuel: 'Diesel', 
        price: 2800, 
        city: 'Hamburg', 
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
        city: 'Paris', 
        url: 'https://www.leboncoin.fr' 
      },
      { 
        id: 'fr2', 
        title: `${brand} ${model}`, 
        year: 2020, 
        km: 71000, 
        fuel: 'Diesel', 
        price: 6800, 
        city: 'Lyon', 
        url: 'https://www.leboncoin.fr' 
      },
      { 
        id: 'fr3', 
        title: `${brand} ${model}`, 
        year: 2018, 
        km: 88000, 
        fuel: 'Diesel', 
        price: 5200, 
        city: 'Marseille', 
        url: 'https://www.leboncoin.fr' 
      },
    ]
  };
}
