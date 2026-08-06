import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Reveal } from "@/components/Reveal";
import portrait from "@/assets/portrait.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Video Editor & Colorist — Cinematic Edit Portfolio" },
      {
        name: "description",
        content:
          "Cinematic video editing, color grading and motion design for brands, music videos and documentaries. Selected work, process and contact.",
      },
      { property: "og:title", content: "Video Editor & Colorist — Cinematic Edit Portfolio" },
      {
        property: "og:description",
        content:
          "Cinematic video editing, color grading and motion design for brands, music videos and documentaries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const NAV = [
  { label: "Work", href: "#work" },
  { label: "Craft", href: "#craft" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const CRAFT = [
  {
    n: "01",
    t: "Story Assembly",
    d: "Footage triaged, selects pulled, and a rhythm built before a single effect is touched. The cut earns its length.",
  },
  {
    n: "02",
    t: "Color Grade",
    d: "Balanced, shaped, and pushed into a signature look — warm keys, protected skin tones, honest blacks.",
  },
  {
    n: "03",
    t: "Sound & Motion",
    d: "Designed sound beds, tight sync, and typography that moves with intent instead of decoration.",
  },
  {
    n: "04",
    t: "Delivery",
    d: "Masters, socials, subtitles and aspect variants — packaged for every platform in one pass.",
  },
];

const STATS = [
  { k: "3+", v: "Films built" },
  { k: "3+ months", v: "Behind the timeline" },
  { k: "48 hr", v: "Typical first cut" },
  { k: "none - looking to surprise you", v: "Brands served" },
];

const MARQUEE = [
  "Premiere Pro",
  "After Effects",
  "CapCut",
  "Illustrator",
  "Photoshop",
  "Color Grading",
  "Sound Design",
  "Motion Graphics",
];

function Index() {
  const [scrolled, setScrolled] = useState(false);
  const [work, setWork] = useState([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const fetchWork = async () => {
      try {
        const response = await fetch('https://videoassets.smaffan.com/metadata.json');
        if (!response.ok) throw new Error('Failed to fetch work metadata');
        const data = await response.json();
        
        // Show both work projects and video projects (exclude work-only filter)
        // Transform to match expected format
        const transformedWork = data.map(item => ({
          src: item.thumbnail,
          title: item.title,
          tag: item.tag || item.category || 'Project',
          year: item.year || new Date().getFullYear().toString(),
          span: item.span || 'lg:col-span-6',
        }));
        setWork(transformedWork);
      } catch (error) {
        console.error('Error fetching work:', error);
        // Fallback to empty array
        setWork([]);
      }
    };

    fetchWork();
  }, []);

  return (
    <div className="grain min-h-screen overflow-x-hidden bg-background text-foreground">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? "border-b border-border/60 bg-background/80 py-3 backdrop-blur-xl"
            : "border-b border-transparent py-6"
        }`}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 sm:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary [animation:pulse-glow_2.6s_ease-in-out_infinite]" />
            <span className="truncate text-display text-2xl tracking-[0.18em]">Muhammad&nbsp;Affan</span>
          </a>
          <nav className="flex items-center gap-6">
            <ul className="hidden items-center gap-7 text-xs uppercase tracking-[0.22em] text-muted-foreground md:flex">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="transition-colors hover:text-primary">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href="#contact"
              className="shrink-0 rounded-full bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground transition-transform duration-300 hover:scale-105"
            >
              Start a project
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative isolate flex min-h-screen items-end overflow-hidden pt-28">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ backgroundImage: "var(--glow-spot)" }}
        />
        <div className="mx-auto grid w-full max-w-7xl items-end gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Reveal>
              <p className="mb-6 text-xs uppercase tracking-[0.42em] text-muted-foreground">
                Video Editor · Colorist · Motion
              </p>
            </Reveal>
            <h1 className="text-display text-[clamp(3.6rem,13vw,10.5rem)]">
              <Reveal delay={80}>
                <span className="block">FRAMES</span>
              </Reveal>
              <Reveal delay={200}>
                <span className="block bronze-text">THAT LINGER</span>
              </Reveal>
            </h1>
            <Reveal delay={340}>
              <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground">
                I cut commercials, music videos and documentaries that hold attention past the
                first three seconds — assembled, graded and scored end to end.
              </p>
            </Reveal>
            <Reveal delay={440}>
              <div className="mt-10 flex items-center gap-6">
                <a
                  href="#work"
                  className="group relative overflow-hidden rounded-full border border-primary/60 px-8 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary"
                >
                  <span className="relative z-10 transition-colors duration-300 group-hover:text-primary-foreground">
                    View the reel
                  </span>
                  <span className="absolute inset-0 -translate-y-full bg-primary transition-transform duration-400 group-hover:translate-y-0" />
                </a>
                <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Scroll ↓
                </span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={200} className="relative">
            <div className="relative mx-auto w-full max-w-sm [animation:float-slow_9s_ease-in-out_infinite]">
              <div
                className="absolute -inset-6 -z-10 rounded-full blur-3xl"
                style={{ background: "var(--glow-spot)" }}
              />
              <img
                src={portrait.url}
                alt="Portrait of the video editor in a tan suit"
                width={892}
                height={1176}
                className="w-full rounded-sm object-cover"
                style={{ maskImage: "linear-gradient(to bottom, black 72%, transparent)" }}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="border-y border-border/60 py-5">
        <div className="flex w-max [animation:marquee_28s_linear_infinite]">
          {[0, 1].map((dup) => (
            <ul key={dup} className="flex items-center gap-12 pr-12">
              {MARQUEE.map((m) => (
                <li
                  key={m + dup}
                  className="flex items-center gap-12 text-display text-2xl tracking-[0.14em] text-muted-foreground"
                >
                  {m}
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      {/* WORK */}
      <section id="work" className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <Reveal>
          <div className="mb-14 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
            <h2 className="text-display text-[clamp(2.6rem,7vw,5.5rem)]">SELECTED WORK</h2>
            <span className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              2026 — 2026
            </span>
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-12">
          {work.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">Loading work...</p>
            </div>
          ) : (
            work.map((w, i) => (
              <Reveal key={w.title} delay={(i % 2) * 120} className={w.span}>
                <article className="group relative h-full overflow-hidden rounded-sm border border-border/60 bg-card">
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={w.src}
                      alt={`${w.title} — ${w.tag} still`}
                      loading="lazy"
                      width={1280}
                      height={720}
                      className="h-full w-full scale-105 object-cover grayscale-[35%] transition-all duration-[900ms] ease-out group-hover:scale-100 group-hover:grayscale-0"
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 p-6">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.28em] text-primary">{w.tag}</p>
                      <h3 className="truncate text-display text-3xl">{w.title}</h3>
                    </div>
                    <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {w.year}
                    </span>
                  </div>
                  <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100" />
                </article>
              </Reveal>
            ))
          )}
        </div>
      </section>

      {/* CRAFT */}
      <section id="craft" className="border-y border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
          <Reveal>
            <h2 className="max-w-3xl text-display text-[clamp(2.4rem,6vw,4.8rem)]">
              EVERY CUT PASSES THROUGH <span className="bronze-text">FOUR HANDS-ON STAGES</span>
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-px overflow-hidden rounded-sm border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
            {CRAFT.map((c, i) => (
              <Reveal key={c.n} delay={i * 100}>
                <div className="group h-full bg-background p-8 transition-colors duration-500 hover:bg-card">
                  <span className="text-display text-5xl text-primary/40 transition-colors duration-500 group-hover:text-primary">
                    {c.n}
                  </span>
                  <h3 className="mt-6 text-xl font-semibold">{c.t}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <div className="relative">
              <img
                src={portrait.url}
                alt="Portrait of the video editor"
                loading="lazy"
                width={892}
                height={1176}
                className="w-full rounded-sm border border-border/60 object-cover"
                style={{ boxShadow: "var(--shadow-cine)" }}
              />
            </div>
          </Reveal>
          <div>
            <Reveal>
              <p className="text-xs uppercase tracking-[0.42em] text-muted-foreground">About</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="mt-6 text-display text-[clamp(2.4rem,6vw,4.6rem)]">
                I EDIT FOR FEEL FIRST, <span className="bronze-text">POLISH SECOND</span>
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-8 max-w-xl leading-relaxed text-muted-foreground">
                The timeline taught me that pacing beats plugins. I work closely with
                directors and founders, protect the intent of the footage, and shape it into
                something that lands — whether it runs 15 seconds on a feed or 15 minutes in a
                festival room.
              </p>
            </Reveal>
            <div className="mt-12 grid grid-cols-2 gap-px border border-border/60 bg-border/60 sm:grid-cols-4">
              {STATS.map((s, i) => (
                <Reveal key={s.v} delay={i * 90}>
                  <div className="h-full bg-background p-6">
                    <p className="text-display text-4xl bronze-text">{s.k}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {s.v}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <footer id="contact" className="relative overflow-hidden border-t border-border/60">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "var(--glow-spot)" }}
        />
        <div className="relative mx-auto max-w-7xl px-5 py-28 text-center sm:px-8">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.42em] text-muted-foreground">
              Booking select projects
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="mt-6 text-display text-[clamp(3rem,12vw,9rem)]">
              LET&apos;S <span className="bronze-text">CUT IT</span>
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <a
              href="mailto:affan4321@gmail.com"
              className="mt-10 inline-block border-b border-primary/50 pb-2 text-lg tracking-[0.12em] text-primary transition-colors hover:border-primary hover:text-foreground sm:text-2xl"
            >
              affan4321@gmail.com
            </a>
          </Reveal>
          <Reveal delay={340}>
            <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <a className="transition-colors hover:text-primary" href="https://www.instagram.com/smaffan92">
                Instagram
              </a>
              <a className="transition-colors hover:text-primary" href="https://github.com/affan4321">
                Github
              </a>
              <a className="transition-colors hover:text-primary" href="https://www.youtube.com/@Techomiame">
                YouTube
              </a>
              <a className="transition-colors hover:text-primary" href="https://www.linkedin.com/in/sheikhmuhammadaffan/">
                LinkedIn
              </a>
            </div>
          </Reveal>
          <p className="mt-14 text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
            © {new Date().getFullYear()} — Muhammad Affan
          </p>
        </div>
      </footer>
    </div>
  );
}
