import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ImageCarousel.module.css";
import type { CarouselAspectRatio } from "../_shared/types";

/**
 * ImageCarousel — scroll-snap carousel with React-driven controls.
 *
 * Track architecture
 * ------------------
 * The slide track is a horizontally-scrolling `<ul>` with
 * `scroll-snap-type: x mandatory`, so native trackpad / touch / wheel
 * scrolling lands on slide boundaries automatically. Pre-hydration the
 * SSR'd track is already functional — visitors can drag through slides
 * before JS arrives. React's job after hydration is just:
 *
 *   1. Wire prev/next buttons to programmatic `scrollTo` on the track.
 *   2. Track which slide is the active snap target via IntersectionObserver
 *      so the dot indicators, arrow disabled state, and aria-live region
 *      update as the user scrolls (regardless of input modality).
 *
 * No wrap-around. With native scroll the user can't infinitely scroll
 * past either end, and JS-only wrap (resetting scrollLeft mid-animation)
 * fights the snap engine. Hitting an edge disables the corresponding
 * arrow — same convention Bandcamp's design system uses.
 *
 * Why IntersectionObserver instead of a `scroll` listener: the observer
 * only fires when intersection state changes (cheap), and combined with
 * a high threshold (0.6) it naturally debounces — no rAF throttling
 * needed.
 */

export interface ImageCarouselSlide {
  src: string;
  alt: string;
  caption?: string;
}

export interface ImageCarouselProps {
  slides: ReadonlyArray<ImageCarouselSlide>;
  areArrowsHidden?: boolean;
  areDotsHidden?: boolean;
  aspectRatio?: CarouselAspectRatio;
}

export default function ImageCarousel({
  slides,
  areArrowsHidden = false,
  areDotsHidden = false,
  aspectRatio = "16/9",
}: ImageCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const slideCount = slides.length;
  const hasMultipleSlides = slideCount > 1;
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === slideCount - 1;
  const activeSlide = slides[activeIndex];

  const scrollToSlide = useCallback((target: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[target] as HTMLElement | undefined;
    if (!slide) return;
    // Compute the absolute scroll offset that places the slide flush at
    // the track's left edge. `scrollIntoView` would also work, but it
    // sometimes scrolls ancestor scrollers too — explicit `scrollTo`
    // confines the motion to the track.
    track.scrollTo({
      left: slide.offsetLeft - track.offsetLeft,
      behavior: "smooth",
    });
  }, []);

  const goNext = useCallback(() => {
    if (!isLast) scrollToSlide(activeIndex + 1);
  }, [activeIndex, isLast, scrollToSlide]);

  const goPrev = useCallback(() => {
    if (!isFirst) scrollToSlide(activeIndex - 1);
  }, [activeIndex, isFirst, scrollToSlide]);

  // Track the active slide as the user scrolls. The observer fires
  // whenever a slide crosses the 60% intersection threshold inside the
  // track viewport — high enough that a slide only "becomes active" once
  // it's the dominant one on screen, low enough that flick-scrolls land
  // on the right index quickly.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !hasMultipleSlides) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // During scroll multiple slides may briefly satisfy the threshold
        // (e.g. when the snap is between two slides). Pick the entry with
        // the highest ratio so the dot state stays deterministic.
        let best: IntersectionObserverEntry | undefined;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }
        if (!best) return;
        const idx = Number((best.target as HTMLElement).dataset.slideIndex);
        if (Number.isFinite(idx)) setActiveIndex(idx);
      },
      { root: track, threshold: 0.6 },
    );

    for (const child of Array.from(track.children)) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [hasMultipleSlides, slideCount]);

  // Keyboard navigation when the track has focus. Arrow keys advance one
  // slide; Home/End jump to the ends. We let the browser handle Tab and
  // PageUp/PageDown natively (the track is overflow:auto so default
  // keyboard scrolling already works there).
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      if (!hasMultipleSlides) return;
      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          event.preventDefault();
          goPrev();
          break;
        case "Home":
          event.preventDefault();
          scrollToSlide(0);
          break;
        case "End":
          event.preventDefault();
          scrollToSlide(slideCount - 1);
          break;
        default:
          break;
      }
    },
    [goNext, goPrev, hasMultipleSlides, scrollToSlide, slideCount],
  );

  if (slideCount === 0) return null;

  const isAspectAuto = aspectRatio === "auto";
  const aspectStyle: React.CSSProperties = isAspectAuto
    ? {}
    : { ["--carousel-aspect-ratio" as string]: aspectRatio };

  return (
    <div
      className={styles.carousel}
      role="region"
      aria-roledescription="carousel"
      aria-label="Image carousel"
    >
      <ul
        ref={trackRef}
        className={styles.track}
        data-aspect-auto={isAspectAuto ? "true" : "false"}
        style={aspectStyle}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {slides.map((slide, index) => (
          <li
            key={`${slide.src}-${index}`}
            className={styles.slide}
            data-slide-index={index}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${index + 1} of ${slideCount}`}
          >
            <img
              src={slide.src}
              alt={slide.alt}
              loading={index === 0 ? "eager" : "lazy"}
              draggable={false}
            />
          </li>
        ))}
      </ul>

      {hasMultipleSlides && !areArrowsHidden && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowPrev}`}
            onClick={goPrev}
            disabled={isFirst}
            aria-label="Previous slide"
          >
            {/* Unicode left-pointing angle. Decorative — aria-label gives
                the accessible name. */}
            <span aria-hidden="true">&#8249;</span>
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowNext}`}
            onClick={goNext}
            disabled={isLast}
            aria-label="Next slide"
          >
            <span aria-hidden="true">&#8250;</span>
          </button>
        </>
      )}

      {hasMultipleSlides && !areDotsHidden && (
        <ul className={styles.dots} role="tablist" aria-label="Slide indicators">
          {slides.map((_, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={index}>
                <button
                  type="button"
                  className={`${styles.dot} ${isActive ? styles.dotActive : ""}`}
                  onClick={() => scrollToSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={isActive ? "true" : undefined}
                  role="tab"
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Live region — announces the active slide's alt text. `polite` so
          the announcement doesn't preempt other speech. */}
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {activeSlide ? activeSlide.alt : ""}
      </div>
    </div>
  );
}
