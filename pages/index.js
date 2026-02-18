import { useState } from 'react';
import Head from 'next/head';

// Liste des marques disponibles
const brands = ['Renault', 'Peugeot', 'Citroën', 'Volkswagen', 'BMW', 'Mercedes', 'Audi', 'Ford', 'Opel', 'Fiat', 'Toyota', 'Nissan', 'Hyundai', 'Kia', 'Skoda', 'Seat'];
const fuels = ['Tous', 'Diesel', 'Essence', 'Hybride', 'Électrique'];

export default function Home() {
  // État du formulaire de recherche
  const [searchParams, setSearchParams] = useState({
    brand: 'Renault',
    model: 'Kangoo',
    yearMin: 2015,
    yearMax: 2024,
    kmMax: 150000,
    fuel: 'Tous',
    priceMax: 15000
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

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams)
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
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Comparez 🇩🇪 Allemagne vs 🇫🇷 France en temps réel</p>
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
              Recherchez un véhicule et voyez instantanément si l'Allemagne offre un meilleur prix.
            </p>
          </div>

          {/* Formulaire de recherche */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '24px', padding: '32px', border: '1px solid #334155', marginBottom: '32px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '18px' }}>
              🔍 Votre recherche
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              
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
                <>⏳ Recherche en cours sur mobile.de et leboncoin...</>
              ) : (
                <>🔍 Comparer les prix Allemagne / France</>
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
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Annonces 🇩🇪</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{results.fr.length}</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Annonces 🇫🇷</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e', margin: 0 }}>{comparisons.length}</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Bonnes affaires</p>
                  </div>
                </div>
                <p style={{ fontSize: '14px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  ℹ️ Seules les annonces où l'Allemagne est moins chère sont affichées
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
                            Comparer sur leboncoin ↗
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
                    Pour cette recherche, les prix en France sont similaires ou inférieurs à l'Allemagne. Essayez avec d'autres critères.
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
                  🔍
                </div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px' }}>Recherche temps réel</h4>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Recherche instantanée sur mobile.de et leboncoin</p>
              </div>
              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '16px', padding: '24px', border: '1px solid #334155', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(34, 197, 94, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                  📉
                </div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px' }}>Économies calculées</h4>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Frais d'import inclus dans le calcul</p>
              </div>
              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '16px', padding: '24px', border: '1px solid #334155', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(168, 85, 247, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                  🔗
                </div>
                <h4 style={{ fontWeight: '600', marginBottom: '8px' }}>Liens directs</h4>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Redirection vers les annonces originales</p>
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
