/**
 * Accessibility Utilities Module
 * 
 * Provides accessibility helpers, ARIA utilities, and
 * focus management for screen reader support.
 * 
 * @module lib/accessibility
 */

// ===========================================
// Types
// ===========================================

export interface AnnouncementOptions {
  /** Announcement priority */
  priority?: 'polite' | 'assertive';
  /** Delay before announcement (ms) */
  delay?: number;
  /** Clear previous announcements */
  clearPrevious?: boolean;
}

export interface FocusTrapOptions {
  /** Element to trap focus within */
  container: HTMLElement;
  /** Initial element to focus */
  initialFocus?: HTMLElement | null;
  /** Return focus to this element on unmount */
  returnFocus?: HTMLElement | null;
  /** Allow escape key to exit trap */
  escapeDeactivates?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
}

// ===========================================
// Screen Reader Announcements
// ===========================================

let announcerElement: HTMLElement | null = null;

/**
 * Initialize the screen reader announcer element
 * Call this once in your app's root component
 */
export function initializeAnnouncer(): void {
  if (typeof document === 'undefined') return;
  if (announcerElement) return;
  
  announcerElement = document.createElement('div');
  announcerElement.setAttribute('aria-live', 'polite');
  announcerElement.setAttribute('aria-atomic', 'true');
  announcerElement.setAttribute('role', 'status');
  announcerElement.className = 'sr-only';
  announcerElement.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  
  document.body.appendChild(announcerElement);
}

/**
 * Announce a message to screen readers
 * 
 * @param message - Message to announce
 * @param options - Announcement options
 * 
 * @example
 * ```ts
 * announce('Form submitted successfully');
 * announce('Error: Invalid email', { priority: 'assertive' });
 * ```
 */
export function announce(
  message: string,
  options: AnnouncementOptions = {}
): void {
  if (typeof document === 'undefined') return;
  
  const {
    priority = 'polite',
    delay = 100,
    clearPrevious = true,
  } = options;
  
  // Initialize if needed
  if (!announcerElement) {
    initializeAnnouncer();
  }
  
  if (!announcerElement) return;
  
  // Update aria-live based on priority
  announcerElement.setAttribute('aria-live', priority);
  
  // Clear previous announcements
  if (clearPrevious) {
    announcerElement.textContent = '';
  }
  
  // Announce after a small delay (helps with screen reader timing)
  setTimeout(() => {
    if (announcerElement) {
      announcerElement.textContent = message;
    }
  }, delay);
}

/**
 * Announce a loading state
 */
export function announceLoading(isLoading: boolean, context?: string): void {
  if (isLoading) {
    announce(context ? `Loading ${context}...` : 'Loading...', { priority: 'polite' });
  } else {
    announce(context ? `${context} loaded` : 'Content loaded', { priority: 'polite' });
  }
}

/**
 * Announce an error
 */
export function announceError(message: string): void {
  announce(`Error: ${message}`, { priority: 'assertive' });
}

/**
 * Announce success
 */
export function announceSuccess(message: string): void {
  announce(message, { priority: 'polite' });
}

// ===========================================
// Focus Management
// ===========================================

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
  return Array.from(elements).filter((el) => {
    // Filter out invisible elements
    return el.offsetParent !== null;
  });
}

/**
 * Get first focusable element in container
 */
export function getFirstFocusable(container: HTMLElement): HTMLElement | null {
  const elements = getFocusableElements(container);
  return elements[0] || null;
}

/**
 * Get last focusable element in container
 */
export function getLastFocusable(container: HTMLElement): HTMLElement | null {
  const elements = getFocusableElements(container);
  return elements[elements.length - 1] || null;
}

/**
 * Focus an element with fallback
 */
export function focusElement(
  element: HTMLElement | null,
  options?: FocusOptions
): void {
  if (!element) return;
  
  // Ensure element is focusable
  if (!element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
  }
  
  element.focus(options);
}

/**
 * Create a focus trap for modals/dialogs
 * 
 * @returns Cleanup function
 * 
 * @example
 * ```ts
 * const cleanup = createFocusTrap({
 *   container: modalElement,
 *   onEscape: () => closeModal(),
 * });
 * 
 * // Later, when modal closes:
 * cleanup();
 * ```
 */
export function createFocusTrap(options: FocusTrapOptions): () => void {
  const {
    container,
    initialFocus,
    returnFocus,
    escapeDeactivates = true,
    onEscape,
  } = options;
  
  const previouslyFocused = document.activeElement as HTMLElement;
  
  // Focus initial element
  const firstFocusable = initialFocus || getFirstFocusable(container);
  focusElement(firstFocusable);
  
  // Handle tab key
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      const focusables = getFocusableElements(container);
      const firstFocusable = focusables[0];
      const lastFocusable = focusables[focusables.length - 1];
      
      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    }
    
    if (event.key === 'Escape' && escapeDeactivates) {
      event.preventDefault();
      onEscape?.();
    }
  };
  
  container.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    
    // Return focus
    const focusTarget = returnFocus || previouslyFocused;
    focusElement(focusTarget);
  };
}

// ===========================================
// ARIA Utilities
// ===========================================

/**
 * Generate unique ID for ARIA relationships
 */
export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Set up ARIA description relationship
 */
export function setAriaDescribedBy(
  element: HTMLElement,
  descriptionId: string
): void {
  const existing = element.getAttribute('aria-describedby');
  if (existing) {
    element.setAttribute('aria-describedby', `${existing} ${descriptionId}`);
  } else {
    element.setAttribute('aria-describedby', descriptionId);
  }
}

/**
 * Create an ARIA live region for dynamic content
 */
export function createLiveRegion(
  priority: 'polite' | 'assertive' = 'polite'
): HTMLElement {
  const region = document.createElement('div');
  region.setAttribute('aria-live', priority);
  region.setAttribute('aria-atomic', 'true');
  region.className = 'sr-only';
  return region;
}

// ===========================================
// Skip Links
// ===========================================

/**
 * Get skip link targets in the document
 */
export function getSkipLinkTargets(): Array<{ id: string; label: string }> {
  const targets: Array<{ id: string; label: string }> = [];
  
  // Main content
  const main = document.querySelector('main');
  if (main) {
    if (!main.id) main.id = 'main-content';
    targets.push({ id: main.id, label: 'Skip to main content' });
  }
  
  // Navigation
  const nav = document.querySelector('nav');
  if (nav) {
    if (!nav.id) nav.id = 'main-navigation';
    targets.push({ id: nav.id, label: 'Skip to navigation' });
  }
  
  return targets;
}

// ===========================================
// Color Contrast Utilities
// ===========================================

/**
 * Calculate relative luminance of a color
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(
  rgb1: [number, number, number],
  rgb2: [number, number, number]
): number {
  const l1 = getRelativeLuminance(...rgb1);
  const l2 = getRelativeLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG requirements
 */
export function meetsContrastRequirement(
  ratio: number,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean {
  const requirements = {
    AA: { normal: 4.5, large: 3 },
    AAA: { normal: 7, large: 4.5 },
  };
  
  const requirement = isLargeText
    ? requirements[level].large
    : requirements[level].normal;
  
  return ratio >= requirement;
}

// ===========================================
// Keyboard Navigation
// ===========================================

export type KeyboardHandler = (event: KeyboardEvent) => void;

export interface KeyboardHandlers {
  onEnter?: KeyboardHandler;
  onSpace?: KeyboardHandler;
  onEscape?: KeyboardHandler;
  onArrowUp?: KeyboardHandler;
  onArrowDown?: KeyboardHandler;
  onArrowLeft?: KeyboardHandler;
  onArrowRight?: KeyboardHandler;
  onHome?: KeyboardHandler;
  onEnd?: KeyboardHandler;
  onTab?: KeyboardHandler;
}

/**
 * Create a keyboard event handler with common key bindings
 */
export function createKeyboardHandler(
  handlers: KeyboardHandlers
): KeyboardHandler {
  return (event: KeyboardEvent) => {
    const handler = {
      Enter: handlers.onEnter,
      ' ': handlers.onSpace,
      Escape: handlers.onEscape,
      ArrowUp: handlers.onArrowUp,
      ArrowDown: handlers.onArrowDown,
      ArrowLeft: handlers.onArrowLeft,
      ArrowRight: handlers.onArrowRight,
      Home: handlers.onHome,
      End: handlers.onEnd,
      Tab: handlers.onTab,
    }[event.key];
    
    if (handler) {
      handler(event);
    }
  };
}

/**
 * Handle roving tabindex for list navigation
 */
export function rovingTabIndex(
  items: HTMLElement[],
  currentIndex: number,
  direction: 'next' | 'prev' | 'first' | 'last'
): number {
  const length = items.length;
  if (length === 0) return -1;
  
  let newIndex: number;
  
  switch (direction) {
    case 'next':
      newIndex = (currentIndex + 1) % length;
      break;
    case 'prev':
      newIndex = (currentIndex - 1 + length) % length;
      break;
    case 'first':
      newIndex = 0;
      break;
    case 'last':
      newIndex = length - 1;
      break;
  }
  
  // Update tabindex
  items.forEach((item, index) => {
    item.setAttribute('tabindex', index === newIndex ? '0' : '-1');
  });
  
  // Focus new item
  items[newIndex]?.focus();
  
  return newIndex;
}

// ===========================================
// Reduced Motion
// ===========================================

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get animation duration based on user preference
 */
export function getAnimationDuration(normalDuration: number): number {
  return prefersReducedMotion() ? 0 : normalDuration;
}

// ===========================================
// Form Accessibility
// ===========================================

/**
 * Announce form errors to screen readers
 */
export function announceFormErrors(errors: string[]): void {
  if (errors.length === 0) return;
  
  const message = errors.length === 1
    ? `Error: ${errors[0]}`
    : `${errors.length} errors: ${errors.join('. ')}`;
  
  announce(message, { priority: 'assertive' });
}

/**
 * Set up error announcement for a form
 */
export function setupFormErrorAnnouncement(
  form: HTMLFormElement,
  getErrors: () => string[]
): () => void {
  const handleInvalid = () => {
    const errors = getErrors();
    announceFormErrors(errors);
  };
  
  form.addEventListener('invalid', handleInvalid, true);
  
  return () => {
    form.removeEventListener('invalid', handleInvalid, true);
  };
}
