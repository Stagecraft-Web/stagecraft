import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ImageCarousel.module.css";
import { clampIndex, nextIndex, prevIndex } from "./indexMath";
import type { CarouselAspectRatio } from "../_shared/types";

/**
 * ImageCarousel — React island that hydrates on top of the Astro shell.
 *
 * The Astro renderer bakes every slide into the page as a static `<img>` so
 * the no-JS experience still shows all photos (horizontal-scroll fallback).
 * When this component hydrates it replaces that shell with an interactive
 * carousel: one slide visible at a time, prev/next arrow buttons, dot
 * indicators, keyboard navigation, and an `aria-live` region that reads
 * the active slide's alt text to assistive tech.
 *
 * No autoplay. Wrap-around at both ends (left arrow on slide 0 jumps to
 * last; right arrow on last slide jumps to 0). Home/End keys clamp
 * (saturate, no wrap) — matches the convention used in desktop apps.
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
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const slideCount = slides.length;
  const activeSlide = slides[activeIndex];
  const hasMultipleSlides = slideCount > 1;

  const goNext = useCallback(() => {
    setActiveIndex((i) => nextIndex(i, slideCount));
  }, [slideCount]);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => prevIndex(i, slideCount));
  }, [slideCount]);

  const goTo = useCallback(
    (target: number) => {
      setActiveIndex(clampIndex(target, slideCount));
    },
    [slideCount],
  );

  // Keyboard navigation — bound to the root element (not window) so arrow
  // keys inside unrelated UI don't hijack focus. Tab is handled natively
  // by the browser, no need to wire it here.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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
          goTo(0);
          break;
        case "End":
          event.preventDefault();
          goTo(slideCount - 1);
          break;
        default:
          break;
      }
    },
    [goNext, goPrev, goTo, hasMultipleSlides, slideCount],
  );

  // If the slide array length ever shrinks below the active index (e.g.
  // in a live-editing scenario), clamp back into range. Defensive; the
  // carousel prop is usually stable post-build.
  useEffect(() => {
    if (activeIndex >= slideCount && slideCount > 0) {
      setActiveIndex(slideCount - 1);
    }
  }, [activeIndex, slideCount]);

  if (slideCount === 0) return null;

  const isAspectAuto = aspectRatio === "auto";
  const aspectStyle: React.CSSProperties = isAspectAuto
    ? {}
    : { ["--carousel-aspect-ratio" as string]: aspectRatio };

  return (
    <div
      ref={rootRef}
      className={styles.carousel}
      role="region"
      aria-roledescription="carousel"
      aria-label="Image carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        className={styles.track}
        data-aspect-auto={isAspectAuto ? "true" : "false"}
        style={aspectStyle}
      >
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={`${slide.src}-${index}`}
              className={`${styles.slide} ${isActive ? styles.slideActive : ""}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${index + 1} of ${slideCount}`}
              aria-hidden={!isActive}
            >
              <img
                src={slide.src}
                alt={slide.alt}
                loading={index === 0 ? "eager" : "lazy"}
                draggable={false}
              />
            </div>
          );
        })}

        {hasMultipleSlides && !areArrowsHidden && (
          <>
            <button
              type="button"
              className={`${styles.arrow} ${styles.arrowPrev}`}
              onClick={goPrev}
              aria-label="Previous slide"
            >
              {/* Unicode left-pointing angle. Decorative — aria-label above
                  gives the accessible name. */}
              <span aria-hidden="true">&#8249;</span>
            </button>
            <button
              type="button"
              className={`${styles.arrow} ${styles.arrowNext}`}
              onClick={goNext}
              aria-label="Next slide"
            >
              <span aria-hidden="true">&#8250;</span>
            </button>
          </>
        )}
      </div>

      {hasMultipleSlides && !areDotsHidden && (
        <ul className={styles.dots} role="tablist" aria-label="Slide indicators">
          {slides.map((_, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={index}>
                <button
                  type="button"
                  className={`${styles.dot} ${isActive ? styles.dotActive : ""}`}
                  onClick={() => goTo(index)}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={isActive ? "true" : undefined}
                  role="tab"
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Live region — announces the active slide's alt text to assistive
          tech. `polite` so the announcement doesn't preempt other speech. */}
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {activeSlide ? activeSlide.alt : ""}
      </div>
    </div>
  );
}
