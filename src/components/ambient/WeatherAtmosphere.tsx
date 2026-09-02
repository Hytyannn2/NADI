/**
 * Ambient Weather Atmosphere Component
 * 
 * Renders an ambient backdrop with dynamic canvas animations that match every
 * live or simulated weather state:
 *  - ⚡ Thunderstorm: Electric lightning flashes, heavy wind-slanted rain & splash ripples
 *  - 🌧️ Heavy / Moderate Rain: Dense falling rain streaks with splash droplets
 *  - 🌦️ Drizzle: Delicate misty rain
 *  - ☁️ Cloudy: Floating translucent mist puffs drifting with wind
 *  - 🌙 Night: Twinkling stars with gentle pulsing alpha
 *  - ☀️ Sunny / Heat: Rising shimmering solar thermal dust matching the thermal gradient
 */
'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { useWeather } from '@/src/hooks/useWeather';

/**
 * Calculates smooth continuous RGB color based on exact temperature (°C).
 * Continuous spectrum across 20°C - 40°C (Malaysian climate thermal wheel).
 */
function getTemperatureRgb(temp: number = 30): [number, number, number] {
  const stops = [
    { temp: 20, r: 30, g: 144, b: 255 },  // 20°C: Cool Sky Blue
    { temp: 25, r: 20, g: 184, b: 166 },  // 25°C: Refreshing Cyan-Teal
    { temp: 30, r: 245, g: 158, b: 11 },  // 30°C: Warm Sunlit Amber-Yellow
    { temp: 35, r: 249, g: 115, b: 22 },  // 35°C: Radiant Deep Orange
    { temp: 40, r: 239, g: 68, b: 68 },   // 40°C: Scorching Fiery Crimson
  ];

  const clamped = Math.max(20, Math.min(40, temp));

  for (let i = 0; i < stops.length - 1; i++) {
    const s = stops[i];
    const e = stops[i + 1];
    if (clamped >= s.temp && clamped <= e.temp) {
      const factor = (clamped - s.temp) / (e.temp - s.temp);
      const r = Math.round(s.r + factor * (e.r - s.r));
      const g = Math.round(s.g + factor * (e.g - s.g));
      const b = Math.round(s.b + factor * (e.b - s.b));
      return [r, g, b];
    }
  }
  return [245, 158, 11];
}

export function WeatherAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { weather } = useWeather();

  const rainMm = weather?.rainMm ?? 0;
  const weatherCode = weather?.weatherCode ?? 0;
  const windSpeed = weather?.windSpeed ?? 10;
  const hour = new Date().getHours();

  // Active weather condition states
  const isThunderstorm = weatherCode === 95 || weatherCode === 96 || weatherCode === 99 || rainMm >= 30.0;
  const isRain = rainMm >= 0.5 || isThunderstorm;
  const isDrizzle = isRain && rainMm < 2.5 && !isThunderstorm;
  const isHeavyRain = isRain && (rainMm >= 10.0 || isThunderstorm);
  const isNight = hour < 6 || hour >= 19;
  const isCloudy = !isRain && (weatherCode === 2 || weatherCode === 3);

  // Danger state disables decorative animations for clarity; warning reduces particle rate
  const isDanger = weather?.floodRisk === 'High' || rainMm >= 25.0;
  const isWarning = !isDanger && (weather?.floodRisk === 'Moderate' || rainMm >= 8.0);
  const isSafe = !isDanger && !isWarning;

  // Compute smooth temperature-based color
  const [tempR, tempG, tempB] = useMemo(() => {
    return getTemperatureRgb(weather?.temp ?? 30);
  }, [weather?.temp]);

  useEffect(() => {
    const isLowEndDevice =
      typeof navigator !== 'undefined' &&
      (((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) < 4 ||
        (navigator.hardwareConcurrency ?? 8) <= 4);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isLowEndDevice || prefersReducedMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isRunning = true;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = 320);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = 320;
    };
    window.addEventListener('resize', handleResize);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animId);
      } else {
        if (!isRunning) {
          isRunning = true;
          animId = requestAnimationFrame(render);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Lightning Flash State for Thunderstorms
    let lightningAlpha = 0;
    let lastLightningTime = Date.now();
    let nextLightningDelay = 3500 + Math.random() * 5000;

    // Wind tilt vector for precipitation
    const windTilt = Math.min(0.6, (windSpeed / 40) * 0.35);

    // Initialize particles according to weather mode
    let particleCount = 24;
    if (isThunderstorm) particleCount = 50;
    else if (isHeavyRain) particleCount = 42;
    else if (isRain) particleCount = isDrizzle ? 18 : 28;
    else if (isNight) particleCount = 36;
    else if (isCloudy) particleCount = 10;
    else particleCount = 22; // Solar dust

    const speedMultiplier = isWarning ? 0.4 : 1.0;

    const particles = Array.from({ length: particleCount }, () => {
      if (isRain) {
        const baseSpeed = isThunderstorm 
          ? 6.5 + Math.random() * 4.5 
          : isHeavyRain 
            ? 5.0 + Math.random() * 3.5 
            : isDrizzle 
              ? 1.8 + Math.random() * 1.5 
              : 3.2 + Math.random() * 2.5;

        const baseLength = isThunderstorm 
          ? 20 + Math.random() * 14 
          : isHeavyRain 
            ? 14 + Math.random() * 10 
            : isDrizzle 
              ? 5 + Math.random() * 5 
              : 9 + Math.random() * 8;

        const baseOpacity = isThunderstorm 
          ? 0.4 + Math.random() * 0.3 
          : isHeavyRain 
            ? 0.3 + Math.random() * 0.25 
            : isDrizzle 
              ? 0.12 + Math.random() * 0.15 
              : 0.22 + Math.random() * 0.2;

        return {
          x: Math.random() * width,
          y: Math.random() * height,
          speed: baseSpeed * speedMultiplier,
          length: baseLength,
          opacity: baseOpacity,
          phase: Math.random() * Math.PI * 2,
          radius: 1 + Math.random() * 2,
        };
      } else if (isNight) {
        // Twinkling Stars
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          speed: 0.05 + Math.random() * 0.05,
          length: 1 + Math.random() * 2,
          opacity: 0.2 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.02 + Math.random() * 0.04,
          radius: 0.8 + Math.random() * 1.6,
        };
      } else if (isCloudy) {
        // Drifting Cloud / Mist Puffs
        return {
          x: Math.random() * width,
          y: Math.random() * (height * 0.8),
          speed: (0.15 + Math.random() * 0.3) * (windSpeed > 15 ? 1.5 : 1),
          length: 40 + Math.random() * 60,
          opacity: 0.06 + Math.random() * 0.08,
          phase: Math.random() * Math.PI * 2,
          radius: 35 + Math.random() * 45,
        };
      } else {
        // Floating Solar Dust Motes (Sunny / Heat)
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          speed: (0.2 + Math.random() * 0.4) * speedMultiplier,
          length: 1 + Math.random() * 2,
          opacity: 0.18 + Math.random() * 0.28,
          phase: Math.random() * Math.PI * 2,
          radius: 1.2 + Math.random() * 1.8,
        };
      }
    });

    const render = () => {
      if (!isRunning) return;
      ctx.clearRect(0, 0, width, height);

      // ── 1. Thunderstorm Lightning Generator ──────────────────────
      if (isThunderstorm) {
        const now = Date.now();
        if (now - lastLightningTime > nextLightningDelay) {
          lightningAlpha = 0.55 + Math.random() * 0.35;
          lastLightningTime = now;
          nextLightningDelay = 3200 + Math.random() * 4500;
        }

        if (lightningAlpha > 0.01) {
          // Electric lightning flash across sky
          ctx.fillStyle = `rgba(224, 242, 254, ${lightningAlpha})`;
          ctx.fillRect(0, 0, width, height);
          lightningAlpha *= 0.86; // rapid decay
          if (lightningAlpha < 0.01) lightningAlpha = 0;
        }
      }

      // ── 2. Rain Precipitation Streaks ────────────────────────────
      if (isRain) {
        particles.forEach((p) => {
          const streakColor = isThunderstorm 
            ? `rgba(186, 230, 253, ${p.opacity})` 
            : `rgba(56, 189, 248, ${p.opacity})`;

          ctx.strokeStyle = streakColor;
          ctx.lineWidth = isThunderstorm ? 1.6 : isHeavyRain ? 1.4 : isDrizzle ? 0.8 : 1.1;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - windTilt * p.length, p.y + p.length);
          ctx.stroke();

          p.y += p.speed;
          p.x -= windTilt * p.speed * 0.3;

          // Recycle raindrop and draw subtle ground splash
          if (p.y > height) {
            p.y = -10;
            p.x = Math.random() * width + 50;
            
            // Draw brief ground splash ring for heavy rain
            if ((isHeavyRain || isThunderstorm) && Math.random() > 0.6) {
              ctx.strokeStyle = `rgba(186, 230, 253, ${p.opacity * 0.4})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.ellipse(p.x, height - 4, 3 + Math.random() * 4, 1.5, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        });
      } else if (isNight) {
        // ── 3. Night Twinkling Stars ────────────────────────────────
        particles.forEach((p) => {
          p.phase = (p.phase || 0) + (p.pulseSpeed || 0.03);
          const dynamicAlpha = Math.max(0.1, p.opacity * (0.6 + 0.4 * Math.sin(p.phase)));

          ctx.fillStyle = `rgba(224, 231, 255, ${dynamicAlpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius || 1.2, 0, Math.PI * 2);
          ctx.fill();

          p.y -= p.speed * 0.1;
          if (p.y < 0) {
            p.y = height;
            p.x = Math.random() * width;
          }
        });
      } else if (isCloudy) {
        // ── 4. Cloudy / Overcast Mist Puffs ─────────────────────────
        particles.forEach((p) => {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius || 40);
          grad.addColorStop(0, `rgba(203, 213, 225, ${p.opacity * 0.4})`);
          grad.addColorStop(0.6, `rgba(148, 163, 184, ${p.opacity * 0.2})`);
          grad.addColorStop(1, 'transparent');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius || 40, 0, Math.PI * 2);
          ctx.fill();

          p.x += p.speed;
          if (p.x - (p.radius || 40) > width) {
            p.x = -(p.radius || 40);
            p.y = Math.random() * (height * 0.8);
          }
        });
      } else {
        // ── 5. Sunny / Extreme Heat Shimmering Solar Dust ───────────
        particles.forEach((p) => {
          p.phase = (p.phase || 0) + 0.02;
          const shimmer = p.opacity * (0.8 + 0.2 * Math.sin(p.phase));

          ctx.fillStyle = `rgba(${tempR}, ${tempG}, ${tempB}, ${shimmer})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius || 1.4, 0, Math.PI * 2);
          ctx.fill();

          p.y -= p.speed * 0.18;
          p.x += Math.sin(p.y * 0.04) * 0.35;
          if (p.y < 0) {
            p.y = height;
            p.x = Math.random() * width;
          }
        });
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animId);
    };
  }, [isThunderstorm, isHeavyRain, isRain, isDrizzle, isNight, isCloudy, isDanger, isWarning, windSpeed, tempR, tempG, tempB]);

  return (
    <div className="absolute top-0 left-0 right-0 h-72 pointer-events-none overflow-hidden z-0 select-none">
      {/* 1. Contextual Sky Gradient Overrides */}
      {isThunderstorm ? (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/60 to-transparent transition-all duration-1000" />
      ) : isDanger ? (
        <div className="absolute inset-0 bg-gradient-to-b from-rose-950/30 via-zinc-950/20 to-transparent transition-all duration-1000" />
      ) : isWarning ? (
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/25 via-zinc-950/15 to-transparent transition-all duration-1000" />
      ) : isNight ? (
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/30 via-slate-950/15 to-transparent transition-all duration-1000" />
      ) : isCloudy ? (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/25 via-zinc-900/10 to-transparent transition-all duration-1000" />
      ) : (
        <>
          {/* Dynamic Continuous Temperature Atmospheric Gradients */}
          <div
            className="absolute inset-0 transition-all duration-1000 ease-out"
            style={{
              background: `linear-gradient(180deg, rgba(${tempR}, ${tempG}, ${tempB}, 0.18) 0%, rgba(${tempR}, ${tempG}, ${tempB}, 0.05) 55%, transparent 100%)`,
            }}
          />
          <div
            className="absolute inset-0 transition-all duration-1000 ease-out"
            style={{
              background: `radial-gradient(ellipse 70% 60% at 50% -10%, rgba(${tempR}, ${tempG}, ${tempB}, 0.24), transparent 75%)`,
            }}
          />
        </>
      )}

      {/* Canvas particle overlay */}
      <canvas ref={canvasRef} className="w-full h-full opacity-70" />
    </div>
  );
}
