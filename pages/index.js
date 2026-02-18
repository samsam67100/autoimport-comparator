import { useState } from 'react';
import Head from 'next/head';

// Liste des marques disponibles
const brands = ['Renault', 'Peugeot', 'Citroën', 'Volkswagen', 'BMW', 'Mercedes', 'Audi', 'Ford', 'Opel', 'Fiat', 'Toyota', 'Nissan', 'Hyundai', 'Kia', 'Skoda', 'Seat', 'Dacia', 'Volvo', 'Porsche', 'Mini'];
const fuels = ['Tous', 'Diesel', 'Essence', 'Hybride', 'Électrique'];
const distances = [
  { value: 0, label: 'Ville uniquement' },
  { value: 50, label: '+ 50 km' },
  { value: 100, label: '+ 100 km' },
  { value: 150, label: '+ 150 km' },
  { value: 200, label: '+ 200 km' },
  { value: 300, label: '+ 300 km' },
];

// Villes françaises principales avec leurs codes postaux
const frenchCities = [
  { name: 'Paris', postalCode: '75000', lat: 48.8566, lng: 2.3522 },
  { name: 'Lyon', postalCode: '69000', lat: 45.764, lng: 4.8357 },
  { name: 'Marseille', postalCode: '13000', lat: 43.2965, lng: 5.3698 },
  { name: 'Toulouse', postalCode: '31000', lat: 43.6047, lng: 1.4442 },
  { name: 'Nice', postalCode: '06000', lat: 43.7102, lng: 7.262 },
  { name: 'Nantes', postalCode: '44000', lat: 47.2184, lng: -1.5536 },
  { name: 'Strasbourg', postalCode: '67000', lat: 48.5734, lng: 7.7521 },
  { name: 'Montpellier', postalCode: '34000', lat: 43.6108, lng: 3.8767 },
  { name: 'Bordeaux', postalCode: '33000', lat: 44.8378, lng: -0.5792 },
  { name: 'Lille', postalCode: '59000', lat: 50.6292, lng: 3.0573 },
  { name: 'Rennes', postalCode: '35000', lat: 48.1173, lng: -1.6778 },
  { name: 'Reims', postalCode: '51100', lat: 49.2583, lng: 4.0317 },
  { name: 'Le Havre', postalCode: '76600', lat: 49.4944, lng: 0.1079 },
  { name: 'Dijon', postalCode: '21000', lat: 47.322, lng: 5.0415 },
  { name: 'Grenoble', postalCode: '38000', lat: 45.1885, lng: 5.7245 },
  { name: 'Angers', postalCode: '49000', lat: 47.4784, lng: -0.5632 },
  { name: 'Clermont-Ferrand', postalCode: '63000', lat: 45.7772, lng: 3.087 },
  { name: 'Metz', postalCode: '57000', lat: 49.1193, lng: 6.1757 },
  { name: 'Nancy', postalCode: '54000', lat: 48.6921, lng: 6.1844 },
  { name: 'Mulhouse', postalCode: '68100', lat: 47.7508, lng: 7.3359 },
  { name: 'Rouen', postalCode: '76000', lat: 49.4432, lng: 1.0999 },
  { name: 'Caen', postalCode: '14000', lat: 49.1829, lng: -0.3707 },
  { name: 'Orléans', postalCode: '45000', lat: 47.9029, lng: 1.909 },
  { name: 'Tours', postalCode: '37000', lat: 47.3941, lng: 0.6848 },
  { name: 'Limoges', postalCode: '87000', lat: 45.8336, lng: 1.2611 },
  { name: 'Perpignan', postalCode: '66000', lat: 42.6986, lng: 2.8956 },
  { name: 'Besançon', postalCode: '25000', lat: 47.2378, lng: 6.0241 },
  { name: 'Brest', postalCode: '29200', lat: 48.3904, lng: -4.4861 },
  { name: 'Amiens', postalCode: '80000', lat: 49.894, lng: 2.2958 },
  { name: 'Poitiers', postalCode: '86000', lat: 46.5802, lng: 0.3404 },
];

export default function Home() {
  // État du formulaire de recherche
  const [searchParams, setSearchParams] = useState({
    brand: 'Renault',
    model: 'Kangoo',
    yearMin: 2015,
    yearMax: 2024,
    kmMax: 150000,
    fuel: 'Tous',
    priceMax: 15000,
    // Nouveaux paramètres de localisation
    city: 'Strasbourg',
    distance: 200
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [comparisons, setComparisons] = useState([]);
  const [error, setError] = useState(null);

  // Fonction de recherche
  const handleSearch = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setComparisons([]);

    // Trouver les coordonnées de la ville sélectionnée
    const selectedCity = frenchCities.find(c => c.name === searchParams.city);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...searchParams,
          cityData: selectedCity
        })
      });

      if (!response.ok) throw new Error('Erreur de recherche');

      const data = await response.json();
      setResults(data);
      
      // Créer les comparaisons
      const matches = [];
      
      data.de.forEach(deCar => {
        const frMatch = data.fr.find(frCar => 
          Math.abs(frCar.year - deCar.year) <= 1 &&
          Math.abs(frCar.km - deCar.km) <= 20000
        );
        
        if (frMatch && deCar.price < frMatch.price) {
          const savings = frMatch.price - deCar.price;
          const importCost = 650;
          const realSavings = savings - importCost;
          
          if (realSavings > 300) {
            matches.push({
              de: deCar,
              fr: frMatch,
              savings,
              importCost,
              realSavings,
              savingsPercent: Math.round((savings / frMatch.price) * 100)
            });
          }
        }
      });
      
      matches.sort((a, b) => b.realSavings - a.realSavings);
      setComparisons(matches);
      
    } catch (err) {
      setError("Erreur lors de la recherche. Réessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>AutoImport - Comparateur France/Allemagne</title>
        <meta name="description" content="Trouvez les meilleures affaires auto en Allemagne" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
        
        {/* Header */}
        <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 24px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #3b82f6, #22c55e)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              🚗
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                Auto<span style={{ color: '#22c55e' }}>Import</span>
              </h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Comparez 🇩🇪 Toute l'Allemagne vs 🇫🇷 Votre région</p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
          
          {/* Titre */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '12px' }}>
              Trouvez les <span style={{ color: '#22c55e' }}>vraies bonnes affaires</span>
            </h2>
            <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '0 auto' }}>
              Comparez les prix de toute l'Allemagne avec les annonces autour de chez vous.
            </p>
          </div>

          {/* Formulaire de recherche */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '24px', padding: '32px', border: '1px solid #334155', marginBottom: '32px' }}>
            
            {/* Section Véhicule */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '16px', color: '#94a3b8' }}>
                🚗 Véhicule recherché
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                
                {/* Marque */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>Marque</label>
                  <select
                    value={searchParams.brand}
                    onChange={(e) => setSearchParams({...searchParams, brand: e.target.value})}
                    style={{ width: '100%', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '16px' }}
                  >
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {/* Modèle */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>Modèle</label>
                  <input
                    type="text"
                    placeholder="Ex: Kangoo, Golf..."
                    value={searchParams.model}
                    onChange={(e) => setSearchParams({...searchParams, model: e.target.value})}
                    style={{ width: '100%', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Carburant */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>Carburant</label>
                  <select
                    value={searchParams.fuel}
                    onChange={(e) => setSearchParams({...searchParams, fuel: e.target.value})}
                    style={{ width: '100%', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '16px' }}
                  >
                    {fuels.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                {/* Prix max */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>Prix max (€)</label>
                  <input
                    type="number"
                    value={searchParams.priceMax}
                    onChange={(e) => setSearchParams({...searchParams, priceMax: parseInt(e.target.value)})}
                    style={{ width: '100%', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Année min */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>Année min</label>
                  <input
                    type="number"
                    value={searchParams.yearMin}
                    onChange={(e) => setSearchParams({...searchParams, yearMin: parseInt(e.target.value)})}
                    style={{ width: '100%', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Année max */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>Année max</label>
                  <input
                    type="number"
                    value={searchParams.yearMax}
                    onChange={(e) => setSearchParams({...searchParams, yearMax: parseInt(e.target.value)})}
                    style={{ width: '100%', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Km max */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>Km max</label>
                  <input
                    type="number"
                    value={searchParams.kmMax}
                    onChange={(e) => setSearchParams({...searchParams, kmMax: parseInt(e.target.value)})}
                    style={{ width: '100%', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Section Localisation */}
            <div style={{ backgroundColor: '#0f172a', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '16px' }}>
                📍 Zone de comparaison
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Allemagne */}
                <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '24px' }}>🇩🇪</span>
                    <span style={{ fontWeight: '600' }}>Allemagne</span>
                  </div>
                  <div style={{ backgroundColor: '#22c55e20', border: '1px solid #22c55e40', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <span style={{ color: '#22c55e', fontWeight: '500' }}>🌍 Tout le pays</span>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                      Recherche nationale pour trouver les meilleurs prix
                    </p>
                  </div>
                </div>

                {/* France */}
                <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '24px' }}>🇫🇷</span>
                    <span style={{ fontWeight: '600' }}>France</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Ville */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Votre ville</label>
                      <select
                        value={searchParams.city}
                        onChange={(e) => setSearchParams({...searchParams, city: e.target.value})}
                        style={{ width: '100%', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '14px' }}
                      >
                        {frenchCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>

                    {/* Rayon */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Rayon</label>
                      <select
                        value={searchParams.distance}
                        onChange={(e) => setSearchParams({...searchParams, distance: parseInt(e.target.value)})}
                        style={{ width: '100%', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '14px' }}
                      >
                        {distances.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                    📍 {searchParams.city} {searchParams.distance > 0 ? `+ ${searchParams.distance} km` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Bouton recherche */}
            <button
              onClick={handleSearch}
              disabled={isLoading || !searchParams.model}
              style={{
                width: '100%',
                background: isLoading ? '#475569' : 'linear-gradient(90deg, #3b82f6, #22c55e)',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '18px',
                padding: '16px 24px',
                borderRadius: '16px',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}
            >
              {isLoading ? (
                <>⏳ Recherche en cours...</>
              ) : (
                <>🔍 Comparer : 🇩🇪 Toute l'Allemagne vs 🇫🇷 {searchParams.city} +{searchParams.distance}km</>
              )}
            </button>
          </div>

          {/* Erreur */}
          {error && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', padding: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <div>
                <p style={{ color: '#f87171', fontWeight: '500', margin: 0 }}>{error}</p>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>Vérifiez votre connexion et réessayez.</p>
              </div>
            </div>
          )}

          {/* Résultats */}
          {results && !isLoading && (
            <div>
              {/* Résumé */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '16px', padding: '16px 24px', marginBottom: '24px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', gap: '32px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{results.de.length}</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>🇩🇪 Toute l'Allemagne</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{results.fr.length}</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>🇫🇷 {searchParams.city} +{searchParams.distance}km</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e', margin: 0 }}>{comparisons.length}</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Bonnes affaires</p>
                  </div>
                </div>
                <p style={{ fontSize: '14px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  ℹ️ Affiche uniquement si l'Allemagne est moins chère
                </p>
              </div>

              {/* Liste des comparaisons */}
              {comparisons.length > 0 ? (
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📉 Bonnes affaires trouvées
                  </h3>

                  {comparisons.map((match, index) => (
                    <div key={index} style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '16px', border: '1px solid #334155', marginBottom: '16px', overflow: 'hidden' }}>
                      
                      {/* Header avec économie */}
                      <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid rgba(34, 197, 94, 0.3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '40px' }}>🚗</span>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{match.de.title}</h4>
                            <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1' }}>{match.de.year} • {match.de.km.toLocaleString()} km • {match.de.fuel}</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e', margin: 0 }}>-{match.realSavings.toLocaleString()}€</p>
                          <p style={{ fontSize: '14px', color: '#86efac', margin: 0 }}>Économie nette ({match.savingsPercent}%)</p>
                        </div>
                      </div>

                      {/* Comparaison côte à côte */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                        
                        {/* Allemagne */}
                        <div style={{ padding: '24px', borderRight: '1px solid #334155' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '20px' }}>🇩🇪</span>
                            <span style={{ fontWeight: '600' }}>mobile.de</span>
                            <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', fontSize: '12px', padding: '4px 8px', borderRadius: '999px' }}>MEILLEUR PRIX</span>
                          </div>
                          
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ color: '#94a3b8' }}>Prix affiché</span>
                              <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{match.de.price.toLocaleString()}€</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                              <span style={{ color: '#94a3b8' }}>Localisation</span>
                              <span style={{ color: '#cbd5e1' }}>{match.de.city}</span>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid #334155', paddingTop: '12px', marginBottom: '16px' }}>
                            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>Frais d'import estimés :</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                              <span style={{ color: '#64748b' }}>Transport + formalités</span>
                              <span style={{ color: '#94a3b8' }}>~{match.importCost}€</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #334155' }}>
                              <span style={{ color: '#3b82f6' }}>Coût total estimé</span>
                              <span style={{ color: '#3b82f6' }}>{(match.de.price + match.importCost).toLocaleString()}€</span>
                            </div>
                          </div>

                          <a
                            href={match.de.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'block', width: '100%', backgroundColor: '#3b82f6', color: 'white', fontWeight: '600', padding: '12px', borderRadius: '12px', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}
                          >
                            Voir sur mobile.de ↗
                          </a>
                        </div>

                        {/* France */}
                        <div style={{ padding: '24px', backgroundColor: 'rgba(15, 23, 42, 0.3)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '20px' }}>🇫🇷</span>
                            <span style={{ fontWeight: '600' }}>leboncoin.fr</span>
                            <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '12px', padding: '4px 8px', borderRadius: '999px' }}>PLUS CHER</span>
                          </div>
                          
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ color: '#94a3b8' }}>Prix affiché</span>
                              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#94a3b8', textDecoration: 'line-through' }}>{match.fr.price.toLocaleString()}€</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                              <span style={{ color: '#94a3b8' }}>Localisation</span>
                              <span style={{ color: '#cbd5e1' }}>{match.fr.city}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                              <span style={{ color: '#94a3b8' }}>Kilométrage</span>
                              <span style={{ color: '#cbd5e1' }}>{match.fr.km.toLocaleString()} km</span>
                            </div>
                          </div>

                          <a
                            href={match.fr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'block', width: '100%', backgroundColor: '#334155', color: 'white', fontWeight: '600', padding: '12px', borderRadius: '12px', textAlign: 'center', textDecoration: 'none', border: '1px solid #475569', boxSizing: 'border-box', marginTop: '68px' }}
                          >
                            Voir sur leboncoin ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '16px', padding: '48px', textAlign: 'center', border: '1px solid #334155' }}>
                  <div style={{ width: '64px', height: '64px', backgroundColor: '#334155', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '32px' }}>
                    🚗
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Pas de bonne affaire trouvée</h3>
                  <p style={{ color: '#94a3b8', maxWidth: '400px', margin: '0 auto' }}>
                    Pour cette recherche autour de {searchParams.city}, les prix en France sont similaires ou inférieurs à l'Allemagne.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Info avant première recherche */}
          {!results && !isLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '16px', padding: '24px', border: '1px solid #334155', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(59, 130, 246, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                  🇩🇪
                </div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px' }}>Allemagne nationale</h4>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Recherche dans tout le pays pour les meilleurs prix</p>
              </div>
              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '16px', padding: '24px', border: '1px solid #334155', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(34, 197, 94, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                  📍
                </div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px' }}>France locale</h4>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Comparaison avec les annonces près de chez vous</p>
              </div>
              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '16px', padding: '24px', border: '1px solid #334155', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(168, 85, 247, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                  💰
                </div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px' }}>Économies réelles</h4>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Frais d'import inclus dans le calcul</p>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid #1e293b', backgroundColor: 'rgba(15, 23, 42, 0.5)', marginTop: '64px', padding: '32px 24px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🚗</span>
              <span style={{ fontWeight: '600' }}>AutoImport</span>
            </div>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
              Ce site redirige vers les annonces originales. Aucune donnée personnelle n'est collectée.
            </p>
            <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#64748b' }}>
              <span>🇩🇪 mobile.de</span>
              <span>🇫🇷 leboncoin.fr</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
