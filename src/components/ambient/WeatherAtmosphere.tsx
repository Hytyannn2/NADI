/**
 * Ambient Weather Atmosphere Component
 * 
 * Renders an ambient gradient and canvas particle backdrop (rain, calm night sky,
 * or daytime sunlight dust) that adjusts dynamically based on local weather conditions.
 * Automatically disables animations on low-spec devices or during high-risk flood alerts.
 */
'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { useWeather } from '@/src/hooks/useWeather';

export function WeatherAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { weather } = useWeather();

  // Danger state disables decorative animations for clarity; warning reduces particle rate
  const isDanger = weather?.floodRisk === 'High' || (weather?.rainMm !== undefined && weather.rainMm >= 25.0);
  const isWarning = !isDanger && (weather?.floodRisk === 'Moderate' || (weather?.rainMm !== undefined && weather.rainMm >= 8.0));
  const isSafe = !isDanger && !isWarning;

  const isRain = (weather?.rainMm ?? 0) > 0;
  
  // Fallback time of day derived from local device clock
  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 10) return 'dawn';
    if (hour >= 10 && hour < 19) return 'day';
    return 'night';
  }, []);

  useEffect(() => {
    // Detects low-spec hardware or reduced motion preference
    const isLowEndDevice =
      typeof navigator !== 'undefined' &&
      (((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) < 4 ||
        (navigator.hardwareConcurrency ?? 8) <= 4);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Disables canvas rendering during emergencies, on low-end devices, or when motion is reduced
    if (isDanger || isLowEndDevice || prefersReducedMotion) {
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

    // Pauses animation loop when tab is backgrounded
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

    // Particle density and velocity scaled by weather state
    const particleCount = isWarning ? 12 : isRain ? 30 : 18;
    const speedMultiplier = isWarning ? 0.4 : 1.0;

    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: (isRain ? 2.5 + Math.random() * 3 : 0.2 + Math.random() * 0.4) * speedMultiplier,
      length: isRain ? 10 + Math.random() * 12 : 1 + Math.random() * 1.5,
      opacity: isWarning ? 0.12 : 0.18 + Math.random() * 0.25,
    }));

    const render = () => {
      if (!isRunning) return;
      ctx.clearRect(0, 0, width, height);

      if (isRain && isSafe) {
        // Rain particle streaks
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 1.0;
        ctx.lineCap = 'round';

        particles.forEach((p) => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.speed * 0.25, p.y + p.length);
          ctx.stroke();

          p.y += p.speed;
          p.x -= p.speed * 0.25;

          if (p.y > height) {
            p.y = -10;
            p.x = Math.random() * width + 50;
          }
        });
      } else if (timeOfDay === 'night') {
        // Night sky ambient stars
        particles.forEach((p) => {
          ctx.fillStyle = `rgba(224, 231, 255, ${p.opacity * 0.4})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.length * 0.5, 0, Math.PI * 2);
          ctx.fill();

          p.y -= p.speed * 0.1;
          if (p.y < 0) {
            p.y = height;
            p.x = Math.random() * width;
          }
        });
      } else {
        // Daytime / dawn floating ambient dust
        particles.forEach((p) => {
          ctx.fillStyle = `rgba(251, 191, 36, ${p.opacity * 0.35})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.length * 0.6, 0, Math.PI * 2);
          ctx.fill();

          p.y -= p.speed * 0.15;
          p.x += Math.sin(p.y * 0.05) * 0.25;
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
  }, [isDanger, isWarning, isSafe, isRain, timeOfDay]);

  return (
    <div className="absolute top-0 left-0 right-0 h-72 pointer-events-none overflow-hidden z-0 select-none">
      {/* Contextual sky gradient based on weather severity and time of day */}
      {isDanger ? (
        <div className="absolute inset-0 bg-gradient-to-b from-rose-950/20 via-zinc-950/10 to-transparent" />
      ) : isWarning ? (
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/20 via-zinc-950/10 to-transparent" />
      ) : isRain ? (
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/15 via-blue-950/5 to-transparent" />
      ) : timeOfDay === 'night' ? (
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950/5 to-transparent" />
      ) : timeOfDay === 'dawn' ? (
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 via-amber-500/5 to-transparent" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/8 via-yellow-500/5 to-transparent" />
      )}

      {/* Canvas overlay rendered in safe and warning modes */}
      {!isDanger && <canvas ref={canvasRef} className="w-full h-full opacity-50" />}
    </div>
  );
}
