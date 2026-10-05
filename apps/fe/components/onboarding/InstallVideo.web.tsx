import React from 'react';

/**
 * Smyčka z obrazovky iPhonu: Sdílet → Přidat na plochu → Přidat. Původně GIF
 * (5,4 MB), převedený na MP4 (~0,5 MB) - iOS Safari ho přehraje inline jen
 * s `muted` + `playsInline`. Načítá se až s tímhle krokem, ne předem.
 */
export default function InstallVideo({ height }: { height: number }) {
  return (
    <video
      src="/tutorial/ios-plocha.mp4"
      poster="/tutorial/ios-plocha-poster.jpg"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-label="Ukázka: Sdílet, Přidat na plochu, Přidat"
      style={{
        height,
        aspectRatio: '480 / 972',
        borderRadius: 24,
        border: '1px solid #E7E3DC',
        display: 'block',
        backgroundColor: '#fff',
      }}
    />
  );
}
