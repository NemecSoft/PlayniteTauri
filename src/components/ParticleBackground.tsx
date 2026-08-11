// ParticleBackground — a fixed, full-screen Three.js particle nebula behind
// the app UI.
//
// - Renders on a separate <canvas> (z-index 0, pointer-events none) so it never
//   blocks clicks or fights the virtualized game grid.
// - Particle colour follows the active theme's accent (read from --accent).
// - GPU-friendly: modest particle count, pauses on tab blur, cleaned up on
//   unmount. Degrades gracefully to nothing if WebGL is unavailable.

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!isWebGLAvailable()) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 5;

    // Particles on a hollow sphere shell.
    const COUNT = 900;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // Random point on sphere, biased inward for a soft core.
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r = 2.2 + Math.random() * 1.6;
      const sr = Math.sqrt(1 - u * u);
      positions[i * 3] = r * sr * Math.cos(phi);
      positions[i * 3 + 1] = r * u;
      positions[i * 3 + 2] = r * sr * Math.sin(phi);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const accent = getAccent();
    const material = new THREE.PointsMaterial({
      size: 0.05,
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // A few larger "star" particles in near-white for depth.
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 8;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    onResize();
    window.addEventListener("resize", onResize);

    let raf = 0;
    let running = true;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!running) return;
      points.rotation.y += 0.0008;
      points.rotation.x = Math.sin(Date.now() * 0.0001) * 0.05;
      renderer.render(scene, camera);
    };
    tick();

    // Pause on tab blur to save GPU.
    const onBlur = () => {
      running = false;
    };
    const onFocus = () => {
      running = true;
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      geometry.dispose();
      material.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 h-full w-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl") || c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

function getAccent(): string {
  if (typeof window === "undefined") return "#6d5df6";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent")
    .trim();
  return v || "#6d5df6";
}
