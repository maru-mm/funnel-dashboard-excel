// =====================================================
// DEFAULT PROMPT TEMPLATES — Affiliate Marketing
// =====================================================

export type PromptCategory =
  | 'spy_ads'
  | 'competitor_analysis'
  | 'trends'
  | 'funnel_analysis'
  | 'content_research'
  | 'offer_discovery';

export interface AffiliatePromptTemplate {
  id: string;
  title: string;
  description: string;
  category: PromptCategory;
  icon: string; // lucide icon name
  prompt: string;
  startUrl: string;
  maxTurns: number;
  /** Whether this template is a good candidate for scheduling */
  schedulable: boolean;
  /** Suggested schedule frequency */
  suggestedFrequency?: 'daily' | 'weekly' | 'bi_weekly';
  tags: string[];
}

export const PROMPT_CATEGORIES: { value: PromptCategory; label: string; color: string; bgColor: string }[] = [
  { value: 'spy_ads', label: 'Spy Ads', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  { value: 'competitor_analysis', label: 'Competitor Analysis', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  { value: 'trends', label: 'Trends & Research', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  { value: 'funnel_analysis', label: 'Funnel Analysis', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  { value: 'content_research', label: 'Content Research', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  { value: 'offer_discovery', label: 'Offer Discovery', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
];

export const AFFILIATE_PROMPT_TEMPLATES: AffiliatePromptTemplate[] = [
  // ===== SPY ADS =====
  {
    id: 'fb-ad-library-health',
    title: 'Facebook Ad Library — Health & Wellness',
    description: 'Scraping della Facebook Ad Library per le ads attive nel settore health & wellness. Raccoglie copy, creatività e landing page.',
    category: 'spy_ads',
    icon: 'Search',
    prompt: `Vai alla Facebook Ad Library (https://www.facebook.com/ads/library/) e cerca ads attive nella categoria "Health & Wellness". 
Per ogni ad trovata (minimo 10), estrai:
1. Testo dell'ad (copy principale)
2. Tipo di creativa (immagine, video, carosello)
3. Nome della pagina che pubblica l'ad
4. Link della landing page (se visibile)
5. Data di inizio dell'ad
6. Paese di targeting (se visibile)

Organizza i risultati in una lista strutturata. Cerca anche varianti della stessa ad per capire quale A/B test stanno facendo.`,
    startUrl: 'https://www.facebook.com/ads/library/',
    maxTurns: 150,
    schedulable: true,
    suggestedFrequency: 'daily',
    tags: ['facebook', 'ads', 'health', 'spy'],
  },
  {
    id: 'fb-ad-library-weight-loss',
    title: 'Facebook Ad Library — Weight Loss',
    description: 'Monitora le ads di weight loss/dimagrimento attive su Facebook. Individua i top advertiser e le loro strategie.',
    category: 'spy_ads',
    icon: 'Search',
    prompt: `Vai alla Facebook Ad Library (https://www.facebook.com/ads/library/) e cerca ads attive relative a "weight loss", "dimagrimento", "fat burner", "appetite suppressant".
Per ogni ad trovata (minimo 10), estrai:
1. Copy dell'ad completo
2. Hook iniziale (prima riga)
3. CTA usata
4. Tipo di creativa
5. Nome dell'advertiser
6. URL della landing page
7. Se sembra un'ad affiliata o brand diretto

Identifica pattern comuni nelle ads: quali hook funzionano? Quali pain point vengono sfruttati? Quali promesse vengono fatte?`,
    startUrl: 'https://www.facebook.com/ads/library/',
    maxTurns: 150,
    schedulable: true,
    suggestedFrequency: 'daily',
    tags: ['facebook', 'ads', 'weight-loss', 'spy'],
  },
  {
    id: 'fb-ad-library-custom',
    title: 'Facebook Ad Library — Ricerca Custom',
    description: 'Cerca nella Facebook Ad Library con keyword personalizzate.',
    category: 'spy_ads',
    icon: 'Search',
    prompt: `Vai alla Facebook Ad Library (https://www.facebook.com/ads/library/) e cerca ads attive con la keyword "[INSERISCI KEYWORD]".
Raccogli almeno 10 ads e per ciascuna estrai:
1. Copy completo dell'ad
2. Hook (prima riga)
3. CTA
4. Tipo creativa (immagine/video/carosello)
5. Landing page URL
6. Advertiser name
7. Data inizio

Analizza i pattern: quali angoli di marketing vengono usati? Quali emozioni sfruttano? C'è un formato dominante?`,
    startUrl: 'https://www.facebook.com/ads/library/',
    maxTurns: 150,
    schedulable: true,
    suggestedFrequency: 'weekly',
    tags: ['facebook', 'ads', 'custom', 'spy'],
  },
  {
    id: 'tiktok-creative-center',
    title: 'TikTok Creative Center — Top Ads',
    description: 'Analizza le top performing ads su TikTok Creative Center per trovare trend e creative vincenti.',
    category: 'spy_ads',
    icon: 'Play',
    prompt: `Vai al TikTok Creative Center (https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en) e analizza le top performing ads.
Filtra per la regione "United States" e il settore "Health".
Per le prime 10 ads trovate, estrai:
1. Descrizione della creativa
2. Hook dei primi 3 secondi
3. Durata del video
4. Numero di like/engagement (se visibile)
5. Call to action usata
6. Brand/advertiser
7. Link alla landing page (se presente)

Identifica i trend: quali format funzionano? UGC vs professionali? Quali hooks catturano l'attenzione?`,
    startUrl: 'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
    maxTurns: 120,
    schedulable: true,
    suggestedFrequency: 'weekly',
    tags: ['tiktok', 'ads', 'creative', 'spy'],
  },

  // ===== COMPETITOR ANALYSIS =====
  {
    id: 'competitor-funnel-analysis',
    title: 'Analisi Funnel Competitor',
    description: 'Analizza il funnel completo di un competitor: dalla landing page al checkout.',
    category: 'competitor_analysis',
    icon: 'Target',
    prompt: `Analizza il funnel completo del sito [INSERISCI URL COMPETITOR].
Naviga attraverso tutto il percorso utente dalla home/landing page fino al checkout. Per ogni step, documenta:
1. URL della pagina
2. Tipo di pagina (landing, VSL, quiz, checkout, upsell, etc.)
3. Headline principale
4. Sub-headline
5. Copy dei CTA button
6. Elementi di urgenza/scarsità
7. Social proof presente (testimonial, reviews, badge)
8. Prezzo mostrato
9. Tecniche di persuasione usate

Alla fine fornisci un summary del funnel flow completo e le tattiche chiave utilizzate.`,
    startUrl: '',
    maxTurns: 200,
    schedulable: false,
    tags: ['competitor', 'funnel', 'analysis'],
  },
  {
    id: 'competitor-pricing-monitor',
    title: 'Monitor Prezzi Competitor',
    description: 'Monitora i prezzi e le offerte dei principali competitor nel tuo settore.',
    category: 'competitor_analysis',
    icon: 'DollarSign',
    prompt: `Visita i seguenti siti competitor e raccogli informazioni sui prezzi e offerte attuali:
[INSERISCI LISTA URL COMPETITOR, uno per riga]

Per ogni competitor documenta:
1. Prodotto/servizio principale
2. Prezzo base
3. Offerte speciali attive (sconti, bundle, trial)
4. Struttura pricing (one-time, subscription, tiered)
5. Garanzia offerta (money back, etc.)
6. Upsell/cross-sell visibili
7. Confronto prezzi se presente
8. Eventuali codici sconto visibili

Crea una tabella comparativa finale.`,
    startUrl: '',
    maxTurns: 150,
    schedulable: true,
    suggestedFrequency: 'weekly',
    tags: ['competitor', 'pricing', 'monitor'],
  },
  {
    id: 'similarweb-competitor',
    title: 'SimilarWeb — Traffic Analysis',
    description: 'Analisi del traffico competitor tramite SimilarWeb: sorgenti, volumi, keyword.',
    category: 'competitor_analysis',
    icon: 'BarChart3',
    prompt: `Vai su SimilarWeb (https://www.similarweb.com) e analizza il traffico del sito [INSERISCI DOMINIO].
Estrai tutte le informazioni disponibili:
1. Traffico mensile stimato
2. Trend di traffico (ultimi 6 mesi)
3. Bounce rate
4. Tempo medio sulla pagina
5. Pagine per visita
6. Top sorgenti di traffico (organic, paid, social, referral, direct)
7. Top keyword organiche
8. Top keyword a pagamento
9. Top siti referral
10. Top canali social
11. Siti competitor più simili

Riassumi i punti di forza e debolezza della strategia di traffico.`,
    startUrl: 'https://www.similarweb.com',
    maxTurns: 100,
    schedulable: true,
    suggestedFrequency: 'weekly',
    tags: ['similarweb', 'traffic', 'competitor'],
  },

  // ===== TRENDS & RESEARCH =====
  {
    id: 'google-trends-health',
    title: 'Google Trends — Health Niche',
    description: 'Analisi dei trend di ricerca Google per il settore health/wellness. Identifica keyword in crescita.',
    category: 'trends',
    icon: 'TrendingUp',
    prompt: `Vai su Google Trends (https://trends.google.com/trends/) e analizza i trend per il settore health e wellness.
Cerca queste keyword e confrontale:
- "weight loss supplement"
- "GLP-1"
- "ozempic alternative"
- "gut health"
- "probiotics"

Per ogni keyword:
1. Trend degli ultimi 12 mesi (in crescita, stabile, in calo)
2. Picco di interesse e quando è avvenuto
3. Regioni con più interesse
4. Query correlate in crescita ("rising")
5. Topic correlati

Poi cerca anche "breakout" queries nel settore salute per scoprire nuovi trend emergenti.
Fornisci un report con le top 5 opportunità basate sui trend.`,
    startUrl: 'https://trends.google.com/trends/',
    maxTurns: 120,
    schedulable: true,
    suggestedFrequency: 'weekly',
    tags: ['google-trends', 'health', 'keyword', 'research'],
  },
  {
    id: 'google-trends-custom',
    title: 'Google Trends — Ricerca Custom',
    description: 'Analisi trend personalizzata su Google Trends con keyword a scelta.',
    category: 'trends',
    icon: 'TrendingUp',
    prompt: `Vai su Google Trends (https://trends.google.com/trends/) e analizza i trend per queste keyword:
[INSERISCI KEYWORD, una per riga]

Per ogni keyword:
1. Trend ultimi 12 mesi
2. Trend ultimi 5 anni
3. Stagionalità (ci sono picchi ricorrenti?)
4. Regioni con più interesse
5. Query correlate in crescita ("rising" e "top")
6. Topic correlati

Confronta le keyword tra loro e identifica:
- Quale ha il trend più positivo
- Quale ha la stagionalità migliore
- Quali query correlate suggeriscono nuove opportunità`,
    startUrl: 'https://trends.google.com/trends/',
    maxTurns: 100,
    schedulable: true,
    suggestedFrequency: 'weekly',
    tags: ['google-trends', 'custom', 'research'],
  },
  {
    id: 'reddit-niche-research',
    title: 'Reddit — Niche Research',
    description: 'Analisi dei subreddit rilevanti per scoprire pain point, domande frequenti e trend nella nicchia.',
    category: 'trends',
    icon: 'MessageCircle',
    prompt: `Vai su Reddit e analizza i seguenti subreddit relativi al settore health/affiliate:
- r/loseit
- r/Supplements  
- r/biohackers
- r/SkincareAddiction

Per ogni subreddit:
1. Post più popolari dell'ultima settimana
2. Domande ricorrenti degli utenti
3. Prodotti/brand menzionati frequentemente
4. Pain point e frustrazioni espresse
5. Soluzioni che gli utenti cercano
6. Linguaggio e terminologia usata dalla community

Crea un report con:
- Top 10 pain point trovati
- Top 5 prodotti/soluzioni menzionate
- Top 5 angoli di marketing suggeriti basati sulle conversazioni reali`,
    startUrl: 'https://www.reddit.com',
    maxTurns: 150,
    schedulable: true,
    suggestedFrequency: 'weekly',
    tags: ['reddit', 'research', 'pain-points', 'niche'],
  },

  // ===== FUNNEL ANALYSIS =====
  {
    id: 'quiz-funnel-breakdown',
    title: 'Quiz Funnel Breakdown',
    description: 'Analisi dettagliata di un quiz funnel: ogni step, logica, copy e conversion triggers.',
    category: 'funnel_analysis',
    icon: 'ClipboardList',
    prompt: `Vai su [INSERISCI URL QUIZ FUNNEL] e completa l'intero quiz funnel dall'inizio alla fine.
Per ogni step del quiz, documenta:
1. Numero dello step e progress (es. 3/10)
2. Domanda posta
3. Opzioni di risposta disponibili
4. Design del layout (vertical list, cards, images, etc.)
5. Elementi visivi (immagini, icone, progressbar)
6. Copy di supporto sotto la domanda
7. CTA button text

Dopo il quiz, analizza la pagina risultato:
1. Come viene personalizzato il risultato
2. Headline e sub-headline
3. Copy dell'offerta
4. Prezzo e struttura pricing
5. Urgenza/scarsità
6. Social proof
7. CTA finale

Fornisci un summary delle tecniche psicologiche usate nel quiz per massimizzare la conversione.`,
    startUrl: '',
    maxTurns: 200,
    schedulable: false,
    tags: ['quiz', 'funnel', 'breakdown'],
  },
  {
    id: 'landing-page-teardown',
    title: 'Landing Page Teardown',
    description: 'Teardown completo di una landing page: struttura, copy, design patterns e conversion elements.',
    category: 'funnel_analysis',
    icon: 'FileSearch',
    prompt: `Analizza la landing page su [INSERISCI URL] facendo un teardown completo.
Scorri l'intera pagina dall'alto in basso e per ogni sezione documenta:
1. Tipo di sezione (hero, features, testimonials, pricing, FAQ, etc.)
2. Headline e copy
3. CTA buttons (testo, colore, posizione)
4. Immagini/video usati
5. Social proof (testimonial, numeri, badge, loghi)
6. Elementi di urgenza/scarsità
7. Above the fold: cosa c'è senza scrollare

Analisi aggiuntiva:
- Tecniche di persuasione usate (AIDA, PAS, etc.)
- Color scheme e branding
- Mobile-friendliness (layout responsive?)
- Loading speed percepita
- Trust elements (garanzia, sicurezza, privacy)

Fornisci un voto da 1-10 per ogni area e suggerimenti di miglioramento.`,
    startUrl: '',
    maxTurns: 100,
    schedulable: false,
    tags: ['landing-page', 'teardown', 'conversion'],
  },
  {
    id: 'checkout-optimization-audit',
    title: 'Checkout Optimization Audit',
    description: 'Audit del processo di checkout: friction points, trust elements, upsell strategy.',
    category: 'funnel_analysis',
    icon: 'ShoppingCart',
    prompt: `Vai su [INSERISCI URL] e naviga fino al processo di checkout (non completare l'acquisto).
Analizza ogni step del checkout process:
1. Quanti step ha il checkout (single page vs multi-step)
2. Campi richiesti in ogni step
3. Metodi di pagamento accettati
4. Trust badges e certificazioni di sicurezza
5. Order summary: come è presentato
6. Upsell/cross-sell nel checkout
7. Order bump (offerta aggiuntiva pre-purchase)
8. Garanzia mostrata
9. Exit intent: ci sono popup?
10. Costi nascosti (shipping, tax)

Fornisci un audit completo con:
- Friction points identificati
- Elementi di trust mancanti
- Opportunità di upsell non sfruttate
- Suggerimenti per aumentare il conversion rate`,
    startUrl: '',
    maxTurns: 150,
    schedulable: false,
    tags: ['checkout', 'optimization', 'audit'],
  },

  // ===== CONTENT RESEARCH =====
  {
    id: 'top-articles-keyword',
    title: 'Top Articles per Keyword',
    description: 'Cerca su Google e analizza i top 5 articoli per una keyword specifica.',
    category: 'content_research',
    icon: 'FileText',
    prompt: `Cerca su Google "[INSERISCI KEYWORD]" e analizza i primi 5 risultati organici.
Per ogni articolo/pagina:
1. URL
2. Title tag
3. Meta description
4. H1 e sotto-titoli principali (H2)
5. Lunghezza stimata del contenuto
6. Struttura dell'articolo (introduzione, sezioni, conclusione)
7. Tipo di contenuto (listicle, guida, review, comparison)
8. CTA presenti (affiliate links, opt-in, etc.)
9. Immagini/media usati
10. Schema di monetizzazione (ads, affiliate, prodotto proprio)

Crea un content brief basato sui pattern trovati:
- Struttura ideale dell'articolo
- H2 da coprire
- Lunghezza consigliata
- Angolo differenziante suggerito
- Keyword LSI da includere`,
    startUrl: 'https://www.google.com',
    maxTurns: 120,
    schedulable: false,
    tags: ['content', 'seo', 'keyword', 'research'],
  },
  {
    id: 'youtube-competitor-videos',
    title: 'YouTube — Video Research',
    description: 'Analisi dei video YouTube top per una keyword: titoli, thumbnail pattern, engagement.',
    category: 'content_research',
    icon: 'Youtube',
    prompt: `Vai su YouTube e cerca "[INSERISCI KEYWORD]".
Analizza i primi 10 video nei risultati:
1. Titolo del video
2. Canale (nome e subscribers se visibile)
3. Visualizzazioni
4. Data di pubblicazione
5. Durata del video
6. Tipo di thumbnail (face, text, before/after, product)
7. Hook nei primi commenti visibili
8. Tipo di contenuto (review, tutorial, story, comparison)

Identifica i pattern:
- Quali titoli performano meglio
- Quale stile di thumbnail è più comune
- Quale durata è preferita
- Come monetizzano (affiliate links in description, sponsorship, etc.)
- Suggerimenti per un video competitivo nella stessa keyword`,
    startUrl: 'https://www.youtube.com',
    maxTurns: 100,
    schedulable: true,
    suggestedFrequency: 'weekly',
    tags: ['youtube', 'video', 'research'],
  },

  // ===== OFFER DISCOVERY =====
  {
    id: 'clickbank-top-offers',
    title: 'ClickBank — Top Offers',
    description: 'Scopri le offerte più vendute su ClickBank: gravity, commissioni e metriche.',
    category: 'offer_discovery',
    icon: 'Award',
    prompt: `Vai su ClickBank Marketplace (https://www.clickbank.com/marketplace/) e analizza le offerte top.
Filtra per la categoria "Health & Fitness" e ordina per "Gravity" (popolarità).
Per le prime 15 offerte:
1. Nome del prodotto
2. Gravity score
3. Commissione media ($/sale)
4. Prezzo del prodotto
5. Tipo di prodotto (digital, physical, subscription)
6. Presenza di recurring billing
7. URL della sales page
8. Tipo di funnel (VSL, long form, quiz)
9. Elementi notevoli della sales page

Identifica trend:
- Quale tipo di prodotto ha gravity più alta
- Range di prezzo ottimale
- Modelli di funnel più usati
- Nicchie emergenti nella categoria health`,
    startUrl: 'https://www.clickbank.com/marketplace/',
    maxTurns: 150,
    schedulable: true,
    suggestedFrequency: 'weekly',
    tags: ['clickbank', 'offers', 'marketplace'],
  },
  {
    id: 'digistore-top-offers',
    title: 'Digistore24 — Top Offers',
    description: 'Analisi delle offerte top su Digistore24: commissioni, sales page e funnel type.',
    category: 'offer_discovery',
    icon: 'Award',
    prompt: `Vai su Digistore24 Marketplace (https://www.digistore24.com/marketplace) e analizza le offerte nella categoria "Health & Fitness".
Per le prime 10 offerte:
1. Nome del prodotto
2. Commissione per vendita
3. Conversion rate medio
4. Earnings per click (EPC)
5. Tipo di prodotto
6. Sales page URL
7. Tipo di funnel usato
8. Materiali affiliati disponibili

Fornisci un ranking delle migliori opportunità basato su: commissione x conversion rate x qualità del funnel.`,
    startUrl: 'https://www.digistore24.com/marketplace',
    maxTurns: 120,
    schedulable: true,
    suggestedFrequency: 'weekly',
    tags: ['digistore24', 'offers', 'marketplace'],
  },
  {
    id: 'affiliate-network-scout',
    title: 'Network Scout — Nuove Offerte',
    description: 'Monitora i principali network affiliate per scoprire nuove offerte appena lanciate.',
    category: 'offer_discovery',
    icon: 'Radar',
    prompt: `Visita i seguenti network affiliate e identifica le offerte NUOVE (lanciate nell'ultimo mese):

1. ClickBank (https://www.clickbank.com/marketplace/) - sezione "New" o ordina per data
2. OfferVault (https://www.offervault.com/) - cerca "health" con filtro date recenti

Per ogni nuova offerta trovata:
1. Nome prodotto
2. Network
3. Commissione
4. Tipo di prodotto
5. Nicchia specifica
6. URL sales page
7. Data di lancio
8. Qualità percepita del funnel (1-10)

Identifica le 5 offerte più promettenti tra quelle nuove e spiega perché.`,
    startUrl: 'https://www.clickbank.com/marketplace/',
    maxTurns: 200,
    schedulable: true,
    suggestedFrequency: 'daily',
    tags: ['network', 'new-offers', 'scout'],
  },
];
