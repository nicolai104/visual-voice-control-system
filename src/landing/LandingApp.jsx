import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AirVent,
  ArrowRight,
  Blinds,
  Check,
  CircleGauge,
  Fan,
  Hand,
  LampCeiling,
  Mic2,
  MonitorCog,
  Play,
  Power,
  ScanFace,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Waves,
} from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { Swiper, SwiperSlide } from "swiper/react";

gsap.registerPlugin(ScrollTrigger);

const SCENES = {
  home: {
    label: "回家",
    summary: "灯光柔和开启，窗帘展开，温度回到舒适区间。",
    light: "65%",
    curtain: "已打开",
    ac: "24°C",
    fan: "低速运行",
    tone: "home",
    command: "打开客厅灯，拉开窗帘，空调调到 24 度",
  },
  away: {
    label: "离家",
    summary: "关闭照明与风扇，窗帘合拢，设备进入低功耗状态。",
    light: "已关闭",
    curtain: "已合拢",
    ac: "待机",
    fan: "已关闭",
    tone: "away",
    command: "执行离家场景，关闭全部设备",
  },
  sleep: {
    label: "睡眠",
    summary: "降低室内亮度，保持轻柔送风，营造安静夜间氛围。",
    light: "18%",
    curtain: "已合拢",
    ac: "27°C",
    fan: "2 档",
    tone: "sleep",
    command: "切换睡眠场景",
  },
  ventilate: {
    label: "通风",
    summary: "打开窗帘与风扇，关闭空调，让空气自然流动。",
    light: "55%",
    curtain: "全开",
    ac: "已关闭",
    fan: "6 档",
    tone: "ventilate",
    command: "打开窗帘和风扇，关闭空调",
  },
};

const NAV_ITEMS = [
  ["交互方式", "#capabilities"],
  ["场景模式", "#scenes"],
  ["专业控制台", "#console"],
];

const LANDMARKS = [
  [32, 67], [41, 58], [49, 48], [54, 35], [58, 22],
  [52, 58], [46, 39], [45, 25], [44, 13], [58, 59],
  [58, 38], [60, 23], [62, 12], [64, 61], [68, 43],
  [72, 29], [75, 19], [68, 66], [78, 56], [84, 46], [89, 38],
];

function ResponsiveImage({ name, alt, className = "", widths = [960, 1440, 1920], sizes = "100vw" }) {
  const srcSet = (format) =>
    widths.map((width) => `/assets/landing/${name}-${width}.${format} ${width}w`).join(", ");
  const fallback = widths[Math.min(1, widths.length - 1)];

  return (
    <picture className={className}>
      <source type="image/avif" srcSet={srcSet("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet("webp")} sizes={sizes} />
      <img
        src={`/assets/landing/${name}-${fallback}.webp`}
        srcSet={srcSet("webp")}
        sizes={sizes}
        alt={alt}
        loading={name === "living-room" ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}

function GlassPanel({ children, className = "" }) {
  return <div className={`glass-panel ${className}`}>{children}</div>;
}

function Waveform({ compact = false }) {
  const bars = useMemo(
    () =>
      Array.from({ length: compact ? 34 : 58 }, (_, index) => {
        const height = 22 + ((index * 17) % 52);
        return <i key={index} style={{ "--bar-height": `${height}%`, "--bar-delay": `${index * -34}ms` }} />;
      }),
    [compact]
  );

  return <span className={`waveform ${compact ? "waveform--compact" : ""}`}>{bars}</span>;
}

function DeviceRows({ scene }) {
  const rows = [
    [LampCeiling, "客厅灯", scene.light],
    [Blinds, "窗帘", scene.curtain],
    [AirVent, "空调", scene.ac],
    [Fan, "风扇", scene.fan],
  ];

  return (
    <div className="device-rows">
      {rows.map(([Icon, label, value]) => (
        <div className="device-row" key={label}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function Hero({ activeScene, onExplore }) {
  const heroRef = useRef(null);

  const handlePointerMove = (event) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    heroRef.current.style.setProperty("--hero-x", x.toFixed(3));
    heroRef.current.style.setProperty("--hero-y", y.toFixed(3));
  };

  return (
    <section
      className={`hero-section scene-tone--${activeScene.tone}`}
      ref={heroRef}
      onPointerMove={handlePointerMove}
      aria-labelledby="hero-title"
    >
      <ResponsiveImage name="living-room" alt="暖色夜间智能客厅" className="hero-media" />
      <div className="hero-ambient" aria-hidden="true" />

      <GlassPanel className="hero-panel hero-panel--left">
        <span className="panel-label">空间状态</span>
        <DeviceRows scene={activeScene} />
      </GlassPanel>

      <GlassPanel className="hero-panel hero-panel--right">
        <span className="execution-title"><Check /> 已执行</span>
        <DeviceRows scene={activeScene} />
      </GlassPanel>

      <GlassPanel className="voice-command">
        <Mic2 aria-hidden="true" />
        <Waveform compact />
        <span>{activeScene.command}</span>
      </GlassPanel>

      <div className="hero-copy">
        <h1 id="hero-title" data-hero-line>
          可视化智能
          <br />
          语音交互控制系统
        </h1>
        <p data-hero-line>语音 · 手势 · 声纹 · 多模态交互，懂你所需的智能空间</p>
        <div className="hero-actions" data-hero-line>
          <a className="button button--primary" href="/app/">
            体验智能空间 <ArrowRight aria-hidden="true" />
          </a>
          <button className="button button--ghost" type="button" onClick={onExplore}>
            探索交互方式 <Play aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="hero-runtime" data-hero-line>
        <span>本地运行</span>
        <span>隐私优先</span>
        <span>实时反馈</span>
        <Activity aria-hidden="true" />
      </div>
    </section>
  );
}

function VoiceFeature() {
  return (
    <article className="feature feature--voice" data-reveal>
      <div className="feature-copy">
        <span className="section-index">01</span>
        <h2>声音成为入口</h2>
        <p>自然语音指令、精准识别理解，让想法即刻转化为空间变化。</p>
        <div className="feature-tags">
          <span><Mic2 />语音识别</span>
          <span><Waves />语义理解</span>
          <span><LampCeiling />意图执行</span>
          <span><CircleGauge />实时反馈</span>
        </div>
      </div>
      <div className="feature-media feature-media--voice">
        <ResponsiveImage name="living-room" alt="" widths={[960, 1440]} sizes="(max-width: 760px) 100vw, 62vw" />
        <GlassPanel className="voice-visualizer">
          <span className="mic-orb"><Mic2 /></span>
          <Waveform />
          <small>正在识别：打开客厅灯</small>
        </GlassPanel>
      </div>
    </article>
  );
}

function GestureFeature() {
  const points = LANDMARKS.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <article className="feature feature--gesture" data-reveal>
      <div className="feature-media feature-media--gesture">
        <ResponsiveImage name="gesture-hand" alt="张开手掌进行智能家居控制" widths={[960, 1440]} sizes="(max-width: 760px) 100vw, 60vw" />
        <svg className="hand-tracking" viewBox="0 0 100 100" aria-hidden="true">
          <polyline points={points} />
          {LANDMARKS.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="0.75" />)}
        </svg>
        <span className="gesture-result"><Hand /> Open_Palm · 96%</span>
      </div>
      <div className="feature-copy">
        <span className="section-index">02</span>
        <h2>手势成为界面</h2>
        <p>无需触碰，隔空即可完成控制。直观、自然，符合你的行为习惯。</p>
        <div className="feature-tags">
          <span><Hand />手势识别</span>
          <span><ScanFace />动作追踪</span>
          <span><Sparkles />状态映射</span>
          <span><MonitorCog />离线控制</span>
        </div>
      </div>
    </article>
  );
}

function VisibilityFeature() {
  return (
    <article className="feature feature--visibility" data-reveal>
      <div className="feature-copy">
        <span className="section-index">03</span>
        <h2>状态始终可见</h2>
        <p>空间状态实时可视化呈现，系统运行、设备联动尽在掌握。</p>
        <div className="feature-tags">
          <span><CircleGauge />设备状态</span>
          <span><Activity />运行诊断</span>
          <span><ShieldCheck />异常告警</span>
          <span><MonitorCog />历史记录</span>
        </div>
      </div>
      <div className="feature-media feature-media--visibility">
        <ResponsiveImage name="living-room" alt="" widths={[960, 1440]} sizes="(max-width: 760px) 100vw, 62vw" />
        <div className="diagnostic-stack">
          <GlassPanel className="metric-panel">
            <span>系统运行状态</span>
            <div className="metric-grid">
              <strong>18<small>%</small><span>CPU 占用</span></strong>
              <strong>34<small>%</small><span>内存占用</span></strong>
              <strong>12<small>ms</small><span>网络延迟</span></strong>
              <strong>98.6<small>%</small><span>识别准确率</span></strong>
            </div>
          </GlassPanel>
          <GlassPanel className="log-panel">
            <span>最近日志</span>
            <p>20:29:41　语音指令：打开客厅灯</p>
            <p>20:29:42　设备状态同步完成</p>
            <p>20:29:43　场景模式：回家</p>
          </GlassPanel>
        </div>
      </div>
    </article>
  );
}

function SceneGallery({ activeKey, onChange }) {
  const active = SCENES[activeKey];
  const slides = Object.entries(SCENES);

  const renderSceneCard = (sceneKey, scene) => (
    <button
      type="button"
      className={`scene-card ${activeKey === sceneKey ? "is-active" : ""}`}
      onClick={() => onChange(sceneKey)}
      aria-pressed={activeKey === sceneKey}
    >
      <ResponsiveImage name="living-room" alt="" widths={[960]} sizes="300px" />
      <span className={`scene-card__filter scene-card__filter--${scene.tone}`} aria-hidden="true" />
      <strong>{scene.label}</strong>
      <small>{scene.summary}</small>
      {activeKey === sceneKey ? <Check className="scene-check" aria-hidden="true" /> : null}
    </button>
  );

  return (
    <section className="scene-section" id="scenes" aria-labelledby="scene-title">
      <div className="section-heading" data-reveal>
        <span />
        <h2 id="scene-title">一键场景模式</h2>
        <span />
      </div>

      <div className={`scene-stage scene-tone--${active.tone}`} data-reveal>
        <ResponsiveImage name="living-room" alt={`${active.label}场景下的智能客厅`} className="scene-stage__media" />
        <div className="scene-stage__filter" aria-hidden="true" />
        <div className="scene-stage__copy">
          <span>{active.label}场景</span>
          <h3>{active.summary}</h3>
        </div>
        <GlassPanel className="scene-stage__status">
          <span className="execution-title"><Power /> 当前设备状态</span>
          <DeviceRows scene={active} />
        </GlassPanel>
      </div>

      <div className="scene-grid scene-grid--desktop" data-reveal>
        {slides.map(([sceneKey, scene]) => (
          <div key={sceneKey}>{renderSceneCard(sceneKey, scene)}</div>
        ))}
      </div>

      <div className="scene-grid scene-grid--mobile">
        <Swiper spaceBetween={14} slidesPerView={1.18}>
          {slides.map(([sceneKey, scene]) => (
            <SwiperSlide key={sceneKey}>{renderSceneCard(sceneKey, scene)}</SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}

function ConsoleSection() {
  return (
    <section className="console-section" id="console" aria-labelledby="console-title">
      <div className="console-copy" data-reveal>
        <h2 id="console-title">专业控制台<br />一切尽在掌控</h2>
        <p>强大的本地控制台，设备管理、场景编排、系统诊断、日志追踪，满足演示与实验需求。</p>
        <ul>
          <li><Check />语音管控</li>
          <li><Check />场景编排</li>
          <li><Check />系统诊断</li>
          <li><Check />日志追踪</li>
        </ul>
        <a className="button button--primary" href="/app/">
          进入控制台预览 <ArrowRight />
        </a>
      </div>
      <div className="console-preview" data-console-preview data-reveal>
        <picture>
          <source srcSet="/assets/landing/console-preview.avif" type="image/avif" />
          <source srcSet="/assets/landing/console-preview.webp" type="image/webp" />
          <img src="/assets/landing/console-preview.webp" alt="现有智能家居专业控制台界面" loading="lazy" />
        </picture>
        <span className="console-glow" aria-hidden="true" />
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="final-cta">
      <ResponsiveImage name="architecture-night" alt="夜间山居智能住宅" className="final-cta__media" />
      <div className="final-cta__copy" data-reveal>
        <h2>让空间理解你<br />让生活更从容</h2>
        <p>可视化智能语音交互控制系统</p>
        <div>
          <a className="button button--primary" href="/app/">体验智能空间 <ArrowRight /></a>
          <a className="button button--ghost" href="#capabilities">探索交互方式</a>
        </div>
      </div>
    </section>
  );
}

export function LandingApp() {
  const [activeScene, setActiveScene] = useState("home");
  const activeSceneData = SCENES[activeScene];

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || window.innerWidth <= 900) return undefined;

    const lenis = new Lenis({ duration: 1.08, smoothWheel: true });
    const update = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    lenis.on("scroll", ScrollTrigger.update);

    return () => {
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from("[data-hero-line]", {
        y: 34,
        opacity: 0,
        duration: 1,
        stagger: 0.12,
        ease: "power3.out",
        delay: 0.18,
      });
      gsap.from(".hero-panel, .voice-command", {
        y: 22,
        opacity: 0,
        duration: 0.9,
        stagger: 0.1,
        ease: "power2.out",
        delay: 0.45,
      });

      gsap.utils.toArray("[data-reveal]").forEach((element) => {
        gsap.from(element, {
          y: 56,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "top 82%",
            once: true,
          },
        });
      });

      gsap.to(".final-cta__media img", {
        yPercent: 8,
        ease: "none",
        scrollTrigger: {
          trigger: ".final-cta",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    });

    return () => context.revert();
  }, []);

  const scrollToCapabilities = () => {
    document.getElementById("capabilities")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="landing-shell">
      <header className="site-nav">
        <a className="site-brand" href="/" aria-label="可视化智能语音交互控制系统首页">
          <span className="site-brand__mark"><SunMedium /></span>
          <span>可视化智能空间</span>
        </a>
        <nav aria-label="首页导航">
          {NAV_ITEMS.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <a className="nav-cta" href="/app/">进入控制台 <ArrowRight /></a>
      </header>

      <main>
        <Hero activeScene={activeSceneData} onExplore={scrollToCapabilities} />
        <section className="capabilities" id="capabilities" aria-label="核心交互能力">
          <VoiceFeature />
          <GestureFeature />
          <VisibilityFeature />
        </section>
        <SceneGallery activeKey={activeScene} onChange={setActiveScene} />
        <ConsoleSection />
        <FinalCta />
      </main>

      <footer>
        <span>可视化智能语音交互控制系统</span>
        <span>本地演示 · 设备仿真 · 隐私优先</span>
      </footer>
    </div>
  );
}
