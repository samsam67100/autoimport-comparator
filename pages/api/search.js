// pages/api/search.js
// Approche simplifiée : utiliser les URLs de recherche texte

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
// 🇩🇪 MOBILE.DE - URL simplifiée avec recherche texte
// ========================================

async function searchMobileDe(token, params) {
  const { brand, model, yearMin, yearMax, kmMax, fuel, priceMax } = params;

  // Construire l'URL comme sur le site mobile.de
  // Format testé et validé : recherche par texte
  const searchText = `${brand} ${model}`.trim();
  
  const urlParams = new URLSearchParams({
    dam: 'false',
    isSearchRequest: 'true',
    s: 'Car',
    vc: 'Car',
    sb: 'rel'
  });

  // Recherche textuelle (le plus fiable)
  urlParams.append('q', searchText);

  // Prix max
  if (priceMax) {
    urlParams.append('p', `:${priceMax}`);
  }

  // Kilométrage max
  if (kmMax) {
    urlParams.append('ml', `:${kmMax}`);
  }

  // Année
  if (yearMin) {
    urlParams.append('fr', `${yearMin}:`);
  }
  if (yearMax) {
    // Si yearMin existe déjà, on le remplace
    if (yearMin) {
      urlParams.set('fr', `${yearMin}:${yearMax}`);
    } else {
      urlParams.append('fr', `:${yearMax}`);
    }
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
          maxItems: 20
        })
      }
    );

    if (!runResponse.ok) {
      console.error('Erreur mobile.de:', await runResponse.text());
      return [];
    }

    const runData = await runResponse.json();
    const results = await waitForResults(token, runData.data.id);

    console.log('🇩🇪 Résultats bruts mobile.de:', results.length);

    // Parser et FILTRER les résultats
    const searchLower = searchText.toLowerCase();
    
    return results
      .map(item => {
        const price = item['price.total.amount'] || 0;

        let km = 0;
        if (item.attributes && item.attributes.Mileage) {
          km = parseInt(String(item.attributes.Mileage).replace(/[^0-9]/g, '')) || 0;
        }

        let year = 0;
        if (item.attributes && item.attributes['First Registration']) {
          const match = item.attributes['First Registration'].match(/(\d{4})/);
          if (match) year = parseInt(match[1]);
        }

        const fuelType = item.attributes?.Fuel || 'N/A';

        let location = 'Allemagne';
        if (item.dealerDetails && item.dealerDetails.address) {
          const addrMatch = item.dealerDetails.address.match(/DE-\d+\s+(.+)$/);
          if (addrMatch) {
            location = addrMatch[1];
          }
        }

        return {
          id: item.url?.match(/id=(\d+)/)?.[1] || Math.random().toString(36).substr(2, 9),
          title: item.title || `${item.brand || ''} ${item.model || ''}`.trim() || 'Véhicule',
          price: price,
          year: year,
          km: km,
          fuel: fuelType,
          url: item.url || 'https://www.mobile.de',
          city: location,
          brand: item.brand || '',
          model: item.model || ''
        };
      })
      .filter(car => {
        // Filtrer : garder seulement les voitures qui correspondent à la recherche
        if (car.price <= 0) return false;
        
        const titleLower = car.title.toLowerCase();
        const brandLower = car.brand.toLowerCase();
        const modelLower = car.model.toLowerCase();
        
        // Vérifier que la marque OU le titre contient le terme recherché
        const brandMatch = brand.toLowerCase();
        const modelMatch = model.toLowerCase();
        
        const hasBrand = titleLower.includes(brandMatch) || brandLower.includes(brandMatch);
        const hasModel = titleLower.includes(modelMatch) || modelLower.includes(modelMatch);
        
        return hasBrand && hasModel;
      });

  } catch (error) {
    console.error('Erreur mobile.de:', error);
    return [];
  }
}

// ========================================
// 🇫🇷 LEBONCOIN - URL comme celle qui a marché
// ========================================

async function searchLeboncoin(token, params) {
  const { brand, model, yearMin, yearMax, kmMax, fuel, priceMax, city, distance, cityData } = params;

  // URL format qui a marché : 
  // https://www.leboncoin.fr/recherche?category=2&text=renault%20kangoo&price=min-10000
  
  const searchText = `${brand} ${model}`.trim();
  
  const urlParams = new URLSearchParams({
    category: '2',
    text: searchText
  });

  // Prix : format "min-max" ou "-max" pour max seulement
  if (priceMax) {
    urlParams.append('price', `min-${priceMax}`);
  }

  // Kilométrage
  if (kmMax) {
    urlParams.append('mileage', `min-${kmMax}`);
  }

  // Année
  if (yearMin && yearMax) {
    urlParams.append('regdate', `${yearMin}-${yearMax}`);
  } else if (yearMin) {
    urlParams.append('regdate', `${yearMin}-`);
  } else if (yearMax) {
    urlParams.append('regdate', `-${yearMax}`);
  }

  // Carburant
  if (fuel && fuel !== 'Tous') {
    const fuelCode = { 'Diesel': '2', 'Essence': '1', 'Hybride': '3', 'Électrique': '4' }[fuel];
    if (fuelCode) urlParams.append('fuel', fuelCode);
  }

  // Localisation
  if (cityData && cityData.lat && cityData.lng && distance > 0) {
    urlParams.append('lat', cityData.lat.toFixed(5));
    urlParams.append('lng', cityData.lng.toFixed(5));
    urlParams.append('radius', (distance * 1000).toString());
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
          maxItems: 20
        })
      }
    );

    if (!runResponse.ok) {
      console.error('Erreur leboncoin:', await runResponse.text());
      return [];
    }

    const runData = await runResponse.json();
    const results = await waitForResults(token, runData.data.id);

    console.log('🇫🇷 Résultats bruts leboncoin:', results.length);

    // Parser les résultats
    const searchLower = searchText.toLowerCase();
    
    return results
      .map(item => {
        let price = 0;
        if (item.price) {
          price = parseInt(String(item.price).replace(/[^0-9]/g, '')) || 0;
        }

        let km = 0;
        const kmValue = item.mileage || item.km || item.attributes?.mileage || item.attributes?.km;
        if (kmValue) {
          km = parseInt(String(kmValue).replace(/[^0-9]/g, '')) || 0;
        }

        let year = 0;
        const yearValue = item.year || item.regdate || item.attributes?.regdate || item.attributes?.year;
        if (yearValue) {
          const match = String(yearValue).match(/20\d{2}|19\d{2}/);
          if (match) year = parseInt(match[0]);
        }

        const location = item.location || item.city || item.attributes?.location || item.attributes?.city || city || 'France';

        return {
          id: item.id || Math.random().toString(36).substr(2, 9),
          title: item.title || item.name || 'Véhicule',
          price: price,
          year: year,
          km: km,
          fuel: item.fuel || item.attributes?.fuel || 'N/A',
          url: item.url || item.link || 'https://www.leboncoin.fr',
          city: location
        };
      })
      .filter(car => {
        if (car.price <= 0) return false;
        
        // Filtrer par marque/modèle dans le titre
        const titleLower = car.title.toLowerCase();
        const brandMatch = brand.toLowerCase();
        const modelMatch = model.toLowerCase();
        
        return titleLower.includes(brandMatch) || titleLower.includes(modelMatch);
      });

  } catch (error) {
    console.error('Erreur leboncoin:', error);
    return [];
  }
}

// ========================================
// ATTENDRE LES RÉSULTATS
// ========================================

async function waitForResults(token, runId, maxWait = 120000) {
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
// DONNÉES DÉMO
// ========================================

function getDemoData(brand, model, city) {
  return {
    de: [
      { id: 'de1', title: `${brand} ${model}`, year: 2019, km: 78000, fuel: 'Diesel', price: 3200, city: 'Berlin', url: 'https://www.mobile.de' },
      { id: 'de2', title: `${brand} ${model}`, year: 2020, km: 65000, fuel: 'Diesel', price: 4100, city: 'Munich', url: 'https://www.mobile.de' },
    ],
    fr: [
      { id: 'fr1', title: `${brand} ${model}`, year: 2019, km: 82000, fuel: 'Diesel', price: 5900, city: city || 'Paris', url: 'https://www.leboncoin.fr' },
      { id: 'fr2', title: `${brand} ${model}`, year: 2020, km: 71000, fuel: 'Diesel', price: 6800, city: city || 'Lyon', url: 'https://www.leboncoin.fr' },
    ]
  };
}
