import Script from 'next/script';
import { ArrowRight, BadgeCheck, Camera, MapPinned, ShieldCheck, Sparkles, Store, Truck, Users } from 'lucide-react';

const platformSignals = [
  {
    label: 'Audituri retail',
    text: 'Verificari de raft, pret, disponibilitate, materiale POS si executie in teren.',
  },
  {
    label: 'Foto-proof & GPS',
    text: 'Dovezi clare, localizare si validare asistata pentru misiuni care trebuie inchise corect.',
  },
  {
    label: 'Activari rapide',
    text: 'Sampling, vizite locale, mystery checks, merchandising si task-uri on-site cu ritm real.',
  },
];

const missionCategories = [
  {
    icon: Store,
    title: 'Retail, merchandising si audituri',
    description:
      'Pentru branduri si retele care au nevoie de verificari recurente, executie vizuala si confirmare rapida din teren.',
  },
  {
    icon: Camera,
    title: 'Proof-of-work documentat',
    description:
      'Fotografii, observatii, status si dovezi standardizate, fara schimburi haotice intre chat, email si foi de calcul.',
  },
  {
    icon: Truck,
    title: 'Livrari si verificari locale',
    description:
      'Misiuni de proximitate, ridicari, confirmari on-site si interventii punctuale acolo unde viteza conteaza.',
  },
  {
    icon: Users,
    title: 'Operatiuni pentru echipe distribuite',
    description:
      'O singura suprafata pentru companii, operatori si executanti care trebuie sa lucreze pe aceeasi versiune a realitatii.',
  },
];

const platformBenefits = [
  {
    title: 'Proof-first execution',
    text: 'Fiecare misiune este gandita sa se inchida cu dovezi clare, nu cu promisiuni sau rapoarte nealiniate.',
  },
  {
    title: 'Potrivire locala mai buna',
    text: 'Platforma este construita pentru contexte reale din Romania, cu sarcini, distante si ritm de lucru locale.',
  },
  {
    title: 'Mai putin haos operational',
    text: 'Mai putine handoff-uri, mai putina ambiguitate, mai multa claritate intre cine cere, cine executa si cine valideaza.',
  },
];

const trustSignals = [
  'Construit pentru branduri, retail, field marketing, verificari on-site si task-uri cu livrare demonstrabila.',
  'Gandit pentru publicul din Romania, cu acoperire in orasele mari si misiuni care au sens in economie reala.',
  'Validarea asistata ramane parte din experienta, fara a inlocui controlul uman acolo unde conteaza.',
];

const cities = ['Bucuresti', 'Cluj-Napoca', 'Iasi', 'Timisoara', 'Brasov', 'Constanta'];

const faqItems = [
  {
    question: 'Ce este Misiuni.ro?',
    answer:
      'Misiuni.ro este o platforma in curs de lansare pentru misiuni reale in teren: audituri retail, activari, verificari locale, foto-proof si executie operationala pentru companii care au nevoie de rezultate clare.',
  },
  {
    question: 'Pentru cine este platforma?',
    answer:
      'Pentru branduri, agentii, operatiuni retail, echipe distribuite si executanti independenti care vor sa lucreze intr-un flux mai clar, cu cerinte bine definite si dovezi usor de verificat.',
  },
  {
    question: 'Ce tipuri de misiuni vor exista?',
    answer:
      'Printre categoriile vizate se afla merchandising, mystery checks, vizite in magazine, sampling, verificari de locatie, ridicari, livrari cu confirmare si alte task-uri locale care cer executie rapida.',
  },
  {
    question: 'Cand intra in lansare publica?',
    answer:
      'Suprafata publica este deja live pentru indexare si prezentare, iar experienta completa va fi extinsa gradual pe aceeasi baza de productie in perioada urmatoare.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'Misiuni.ro',
      url: 'https://misiuni.ro/',
      inLanguage: 'ro-RO',
      description:
        'Platforma premium in curs de lansare pentru audituri retail, activari, verificari locale si misiuni reale in teren in Romania.',
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ],
};

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden text-[var(--ink)]">
      <div className="grain-bg" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-a" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-b" aria-hidden="true" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <Script
          id="misiuni-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />

        <section className="hero-shell fade-rise">
          <div className="grid gap-8 px-5 py-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] lg:px-8 lg:py-8">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="section-kicker">In curand in Romania</span>
                <span className="signal-pill">Premium coming-soon preview</span>
              </div>

              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-ink sm:text-6xl lg:text-7xl">
                Misiuni.ro pregateste o piata premium pentru misiuni reale, verificari in teren si activari rapide.
              </h1>

              <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">
                Un singur loc pentru companii si echipe locale care au nevoie de audituri retail, merchandising,
                activari, livrari cu proof, foto-validare si executie operationala in Romania. Misiuni.ro este
                gandit pentru teren real, ritm real si rezultate care se pot verifica fara improvizatii.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a className="primary-btn" href="#platform-overview">
                  Descopera platforma
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a className="secondary-btn" href="#faq">
                  Intrebari frecvente
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {platformSignals.map((signal) => (
                  <section key={signal.label} className="metric-card">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay-700">{signal.label}</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{signal.text}</p>
                  </section>
                ))}
              </div>
            </div>

            <div className="space-y-4 fade-rise fade-rise-delay-1">
              <section className="soft-card">
                <div className="flex items-center gap-3 text-clay-700">
                  <Sparkles className="h-5 w-5" />
                  <p className="text-sm font-semibold uppercase tracking-[0.2em]">Ce pregatim pentru lansare</p>
                </div>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                  Publicul va descoperi o suprafata curata, premium si usor de inteles, in spatele careia se
                  pregateste o infrastructura reala pentru activari, verificari si misiuni locale executate cu dovada.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl bg-spruce-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-spruce-700">Pentru companii</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      Task-uri clare, executie distribuita si vizibilitate mai buna asupra a ceea ce se intampla in teren.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-clay-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay-700">Pentru executanti</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      Misiuni reale, instructiuni mai bune si un flux mai clar intre acceptare, dovada si validare.
                    </p>
                  </div>
                </div>
              </section>

              <section className="soft-card">
                <div className="flex items-center gap-3 text-spruce-700">
                  <ShieldCheck className="h-5 w-5" />
                  <p className="text-sm font-semibold uppercase tracking-[0.2em]">Semnal public</p>
                </div>
                <div className="mt-4 rounded-2xl bg-white/75 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-700">
                    <MapPinned className="h-4 w-4 text-clay-700" />
                    Orase urmarite la lansare
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cities.map((city) => (
                      <span
                        key={city}
                        className="rounded-full border border-black/10 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700"
                      >
                        {city}
                      </span>
                    ))}
                  </div>
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)]">
                  {trustSignals.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-spruce-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </section>

        <section id="platform-overview" className="mt-8 fade-rise fade-rise-delay-1">
          <div className="mb-4 flex items-center gap-3">
            <span className="section-kicker">Ce va gasi publicul la lansare</span>
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Users className="h-4 w-4 text-clay-600" />
              Gandit pentru companii, operatori si echipe de teren care au nevoie de claritate, nu de landing pages goale.
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {missionCategories.map((category, index) => {
              const Icon = category.icon;

              return (
                <section
                  key={category.title}
                  className={`soft-card fade-rise ${index === 1 ? 'fade-rise-delay-1' : index >= 2 ? 'fade-rise-delay-2' : ''}`}
                >
                  <div className="flex items-center gap-3 text-clay-700">
                    <Icon className="h-5 w-5" />
                    <span className="rounded-full bg-clay-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-clay-700">
                      Domeniu
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-ink">{category.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{category.description}</p>
                </section>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="soft-card fade-rise fade-rise-delay-1">
            <div className="flex items-center gap-3 text-clay-700">
              <BadgeCheck className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.2em]">De ce va parea diferit</p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {platformBenefits.map((benefit) => (
                <div key={benefit.title} className="rounded-2xl bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-700">{benefit.title}</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{benefit.text}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="soft-card fade-rise fade-rise-delay-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-spruce-700">Cum arata lansarea publica</p>
            <div className="mt-4 space-y-3">
              <div className="timeline-step">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-spruce-700">01</p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  Un mesaj clar despre ce este Misiuni.ro si de ce merita urmarit inca dinaintea lansarii complete.
                </p>
              </div>
              <div className="timeline-step">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-spruce-700">02</p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  Continut indexabil pentru cautari legate de audituri, activari, verificari si executie locala in Romania.
                </p>
              </div>
              <div className="timeline-step">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-spruce-700">03</p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  Aceeasi baza de productie pe care va continua sa creasca experienta publica, fara reset de brand sau de infrastructura.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section id="faq" className="mt-8 soft-card fade-rise fade-rise-delay-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="section-kicker">FAQ</span>
            <p className="text-sm text-[var(--muted)]">Intrebari publice utile pentru vizitatori si pentru primele semnale SEO.</p>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {faqItems.map((item) => (
              <article key={item.question} className="rounded-[28px] border border-black/10 bg-white/70 p-5">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">{item.question}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-6 flex flex-col gap-3 border-t border-black/10 px-1 pt-4 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>Misiuni.ro intra in lansare publica in curand, pe aceeasi baza de productie care va sustine si experienta completa.</p>
          <div className="flex items-center gap-3">
            <a className="font-semibold text-ink transition-colors hover:text-clay-700" href="#platform-overview">
              Platforma
            </a>
            <a className="font-semibold text-ink transition-colors hover:text-clay-700" href="#faq">
              FAQ
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}