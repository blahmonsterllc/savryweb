# 🎨 Savry Design System

> **Complete design guide for maintaining consistent aesthetics across iOS app and website**

---

## 🌈 Color Palette

### Primary Colors

```css
/* Teal/Turquoise - Primary Brand Color */
--primary-teal: #4ECDC4
--primary-teal-light: #7FE3DB
--primary-teal-dark: #44A08D

/* Orange - Accent & CTA Color */
--accent-orange: #FF6B6B
--accent-orange-light: #FF8E8E
--accent-orange-dark: #E85555

/* Green - Success & Healthy */
--success-green: #4CAF50
--success-green-light: #81C784
--success-green-dark: #388E3C
```

### Neutral Colors

```css
/* Background Colors */
--background-primary: #FFFFFF
--background-secondary: #F7F9FB
--background-tertiary: #F0F4F8

/* Text Colors */
--text-primary: #1A1A1A
--text-secondary: #6B7280
--text-tertiary: #9CA3AF
--text-inverse: #FFFFFF

/* Border Colors */
--border-light: #E5E7EB
--border-medium: #D1D5DB
--border-dark: #9CA3AF
```

### Status Colors

```css
/* Status Indicators */
--status-info: #3B82F6
--status-warning: #F59E0B
--status-error: #EF4444
--status-success: #10B981
```

### Semantic Colors

```css
/* Recipe Categories */
--breakfast-yellow: #FFA726
--lunch-blue: #42A5F5
--dinner-purple: #AB47BC
--snack-green: #66BB6A
--dessert-pink: #EC407A
```

---

## 📝 Typography

### Font System

**Primary Font Family:**
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
```

**For Numbers/Metrics:**
```css
font-variant-numeric: tabular-nums;
```

### Type Scale

```css
/* Display Text */
--font-size-display: 56px;      /* Splash screen */
--font-weight-display: 700;

/* Large Title */
--font-size-large-title: 34px;  /* Main headers */
--font-weight-large-title: 700;
--line-height-large-title: 41px;

/* Title 1 */
--font-size-title-1: 28px;      /* Section headers */
--font-weight-title-1: 700;
--line-height-title-1: 34px;

/* Title 2 */
--font-size-title-2: 22px;      /* Subsection headers */
--font-weight-title-2: 700;
--line-height-title-2: 28px;

/* Title 3 */
--font-size-title-3: 20px;      /* Card titles */
--font-weight-title-3: 600;
--line-height-title-3: 25px;

/* Headline */
--font-size-headline: 17px;     /* Primary text */
--font-weight-headline: 600;
--line-height-headline: 22px;

/* Body */
--font-size-body: 17px;         /* Body text */
--font-weight-body: 400;
--line-height-body: 22px;

/* Callout */
--font-size-callout: 16px;      /* Secondary text */
--font-weight-callout: 400;
--line-height-callout: 21px;

/* Subheadline */
--font-size-subheadline: 15px;  /* Metadata */
--font-weight-subheadline: 400;
--line-height-subheadline: 20px;

/* Footnote */
--font-size-footnote: 13px;     /* Small text */
--font-weight-footnote: 400;
--line-height-footnote: 18px;

/* Caption 1 */
--font-size-caption-1: 12px;    /* Tiny text */
--font-weight-caption-1: 400;
--line-height-caption-1: 16px;

/* Caption 2 */
--font-size-caption-2: 11px;    /* Extra tiny */
--font-weight-caption-2: 400;
--line-height-caption-2: 13px;
```

### Usage Examples

```html
<!-- Page Title -->
<h1 class="large-title">My Recipes</h1>

<!-- Section Header -->
<h2 class="title-2">Breakfast Favorites</h2>

<!-- Card Title -->
<h3 class="title-3">Fluffy Pancakes</h3>

<!-- Description -->
<p class="headline">Delicious breakfast recipe perfect for weekends</p>

<!-- Body Text -->
<p class="body">Start your day with these amazing pancakes...</p>

<!-- Metadata -->
<span class="subheadline">Updated 2 hours ago</span>
```

---

## 🎯 Spacing System

### Base Unit: 4px

```css
/* Spacing Scale (multiples of 4) */
--space-1: 4px;    /* 0.25rem */
--space-2: 8px;    /* 0.5rem */
--space-3: 12px;   /* 0.75rem */
--space-4: 16px;   /* 1rem */
--space-5: 20px;   /* 1.25rem */
--space-6: 24px;   /* 1.5rem */
--space-8: 32px;   /* 2rem */
--space-10: 40px;  /* 2.5rem */
--space-12: 48px;  /* 3rem */
--space-16: 64px;  /* 4rem */
--space-20: 80px;  /* 5rem */
```

### Common Usage

```css
/* Card Padding */
padding: 20px;      /* var(--space-5) */

/* Section Spacing */
margin-bottom: 24px; /* var(--space-6) */

/* Content Padding */
padding: 16px;      /* var(--space-4) */

/* Tight Spacing */
gap: 12px;          /* var(--space-3) */
```

---

## 🔲 Corner Radius

```css
/* Border Radius System */
--radius-xs: 4px;    /* Tiny elements */
--radius-sm: 8px;    /* Buttons, small cards */
--radius-md: 12px;   /* Standard cards */
--radius-lg: 16px;   /* Large cards */
--radius-xl: 20px;   /* Extra large cards */
--radius-2xl: 24px;  /* Hero cards */
--radius-full: 9999px; /* Pills, circles */
```

### Usage

```css
/* Standard Card */
border-radius: 12px;  /* var(--radius-md) */

/* Button */
border-radius: 8px;   /* var(--radius-sm) */

/* Large Feature Card */
border-radius: 20px;  /* var(--radius-xl) */

/* Pill Badge */
border-radius: 9999px; /* var(--radius-full) */
```

---

## 🌟 Shadows

### Shadow System

```css
/* Elevation Shadows */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.10);
--shadow-xl: 0 12px 24px rgba(0, 0, 0, 0.12);
--shadow-2xl: 0 20px 40px rgba(0, 0, 0, 0.15);

/* Colored Shadows (for emphasis) */
--shadow-orange: 0 8px 16px rgba(255, 107, 107, 0.3);
--shadow-teal: 0 8px 16px rgba(78, 205, 196, 0.3);
--shadow-green: 0 8px 16px rgba(76, 175, 80, 0.3);
```

### Usage

```css
/* Floating Card */
box-shadow: var(--shadow-md);

/* Prominent CTA Button */
box-shadow: var(--shadow-orange);

/* Subtle Elevation */
box-shadow: var(--shadow-sm);
```

---

## 🎨 Gradients

### Brand Gradients

```css
/* Primary Teal Gradient (Splash Screen, Headers) */
background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);

/* Accent Orange Gradient (CTA Buttons) */
background: linear-gradient(135deg, #FF6B6B 0%, #E85555 100%);

/* Warm Gradient (Meal Planner) */
background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);

/* Subtle Background Gradient */
background: linear-gradient(180deg, #FFFFFF 0%, #F7F9FB 100%);

/* Card Hover Gradient */
background: linear-gradient(135deg, 
  rgba(78, 205, 196, 0.05) 0%, 
  rgba(255, 107, 107, 0.05) 100%
);
```

### Gradient Backgrounds (Subtle)

```css
/* Page Background */
background: linear-gradient(180deg, 
  rgba(255, 107, 107, 0.05) 0%, 
  rgba(78, 205, 196, 0.05) 100%
);

/* Section Background */
background: linear-gradient(135deg, 
  rgba(78, 205, 196, 0.1) 0%, 
  rgba(68, 160, 141, 0.1) 100%
);
```

---

## 🧩 UI Components

### 1. Cards

```css
.card {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
}
```

**Recipe Card Example:**
```html
<div class="recipe-card">
  <img class="recipe-image" src="..." alt="Recipe">
  <div class="recipe-content">
    <h3 class="recipe-title">Fluffy Pancakes</h3>
    <p class="recipe-meta">30 mins • 4 servings</p>
    <div class="recipe-tags">
      <span class="tag">Breakfast</span>
      <span class="tag">Easy</span>
    </div>
  </div>
</div>
```

```css
.recipe-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.recipe-image {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.recipe-content {
  padding: 16px;
}

.recipe-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.recipe-meta {
  color: #6B7280;
  font-size: 14px;
  margin-bottom: 12px;
}
```

### 2. Buttons

```css
/* Primary Button (Orange) */
.btn-primary {
  background: linear-gradient(135deg, #FF6B6B 0%, #E85555 100%);
  color: white;
  padding: 14px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 17px;
  border: none;
  box-shadow: 0 8px 16px rgba(255, 107, 107, 0.3);
  transition: all 0.3s ease;
  cursor: pointer;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(255, 107, 107, 0.4);
}

/* Secondary Button (Teal) */
.btn-secondary {
  background: #4ECDC4;
  color: white;
  padding: 14px 24px;
  border-radius: 12px;
  font-weight: 600;
  border: none;
  transition: all 0.3s ease;
}

/* Outline Button */
.btn-outline {
  background: transparent;
  color: #4ECDC4;
  padding: 12px 20px;
  border: 2px solid #4ECDC4;
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-outline:hover {
  background: #4ECDC4;
  color: white;
}

/* Small Button / Pill */
.btn-pill {
  background: rgba(78, 205, 196, 0.15);
  color: #4ECDC4;
  padding: 6px 16px;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 600;
  border: none;
}
```

### 3. Tags/Badges

```css
.tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}

/* Category Tags */
.tag-breakfast {
  background: rgba(255, 167, 38, 0.15);
  color: #F57C00;
}

.tag-lunch {
  background: rgba(66, 165, 245, 0.15);
  color: #1976D2;
}

.tag-dinner {
  background: rgba(171, 71, 188, 0.15);
  color: #7B1FA2;
}

.tag-snack {
  background: rgba(102, 187, 106, 0.15);
  color: #388E3C;
}

/* Pro Badge */
.badge-pro {
  background: linear-gradient(135deg, #FF6B6B 0%, #FFA726 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

### 4. Input Fields

```css
.input-field {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  font-size: 17px;
  transition: all 0.3s ease;
  background: white;
}

.input-field:focus {
  outline: none;
  border-color: #4ECDC4;
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
}

.input-field::placeholder {
  color: #9CA3AF;
}

/* Search Bar */
.search-bar {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #9CA3AF;
}

.search-input {
  padding-left: 44px;
  background: #F7F9FB;
  border: 2px solid transparent;
}
```

### 5. Status Indicators

```css
/* Connection Status */
.status-banner {
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.status-connected {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.status-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #D97706;
}

.status-error {
  background: rgba(239, 68, 68, 0.1);
  color: #DC2626;
}

.status-info {
  background: rgba(59, 130, 246, 0.1);
  color: #2563EB;
}
```

---

## 🔄 Animations

### Transition Timing

```css
/* Standard Transitions */
--transition-fast: 0.15s ease;
--transition-base: 0.3s ease;
--transition-slow: 0.5s ease;

/* Easing Functions */
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Common Animations

```css
/* Hover Scale */
.hover-scale {
  transition: transform 0.3s ease;
}

.hover-scale:hover {
  transform: scale(1.02);
}

/* Fade In */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.5s ease;
}

/* Pulse (for loading states) */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Slide In From Bottom */
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-in-up {
  animation: slideInUp 0.4s ease;
}
```

---

## 🎯 Layout Patterns

### Page Container

```css
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

@media (min-width: 768px) {
  .page-container {
    padding: 0 40px;
  }
}
```

### Grid Layouts

```css
/* Recipe Grid */
.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

@media (min-width: 768px) {
  .recipe-grid {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 32px;
  }
}

/* Two Column Layout */
.two-column {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 768px) {
  .two-column {
    grid-template-columns: 2fr 1fr;
    gap: 40px;
  }
}
```

### Flexbox Patterns

```css
/* Center Content */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Space Between */
.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Column Stack */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

---

## 🖼️ Images & Media

### Recipe Images

```css
.recipe-image {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 12px;
}

/* With Overlay */
.recipe-image-overlay {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}

.recipe-image-overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.6) 100%
  );
}
```

### Placeholder States

```css
/* Loading Skeleton */
.skeleton {
  background: linear-gradient(
    90deg,
    #F0F4F8 0%,
    #E5E7EB 50%,
    #F0F4F8 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile First Approach */
--breakpoint-sm: 640px;   /* Small devices */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
--breakpoint-2xl: 1536px; /* Large screens */
```

### Usage

```css
/* Mobile */
.container {
  padding: 16px;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 32px;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    padding: 48px;
  }
}
```

---

## 🎨 Design Principles

### 1. **Clean & Minimal**
- Lots of white space
- Clear hierarchy
- Uncluttered interfaces

### 2. **Friendly & Approachable**
- Rounded corners everywhere
- Soft shadows
- Warm color palette
- Emoji accents 🥕🍅

### 3. **Professional Yet Playful**
- Bold typography for impact
- Subtle animations
- Colorful but not overwhelming
- Clear call-to-actions

### 4. **Mobile-First**
- Touch-friendly targets (min 44x44px)
- Easy thumb reach
- Large tap areas
- Swipe gestures

### 5. **Consistency**
- Same spacing system everywhere
- Consistent corner radius
- Uniform shadows
- Predictable interactions

---

## 🎯 Common UI Patterns

### Empty States

```html
<div class="empty-state">
  <div class="empty-icon">🍳</div>
  <h3 class="empty-title">No Recipes Yet</h3>
  <p class="empty-description">Start by adding your first recipe</p>
  <button class="btn-primary">Add Recipe</button>
</div>
```

```css
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 8px;
}

.empty-description {
  color: #6B7280;
  font-size: 15px;
  margin-bottom: 24px;
}
```

### Loading States

```html
<div class="loading-card">
  <div class="skeleton skeleton-image"></div>
  <div class="skeleton skeleton-title"></div>
  <div class="skeleton skeleton-text"></div>
</div>
```

### Success/Error Messages

```css
.message {
  padding: 16px 20px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  font-weight: 500;
}

.message-success {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border-left: 4px solid #10B981;
}

.message-error {
  background: rgba(239, 68, 68, 0.1);
  color: #DC2626;
  border-left: 4px solid #EF4444;
}
```

---

## 🎨 Brand Guidelines

### Logo Usage

- **Primary Logo**: Savry wordmark in teal (#4ECDC4)
- **Icon Only**: Savry icon for social media
- **Minimum Size**: 120px wide for logo
- **Clear Space**: Minimum 20px around logo
- **Don't**: Stretch, rotate, or change colors

### Voice & Tone

- **Friendly**: "Let's cook something amazing!"
- **Helpful**: Clear instructions, no jargon
- **Encouraging**: "You've got this!"
- **Professional**: Accurate information
- **Fun**: Use emojis appropriately 🎉

---

## 📚 Component Library Examples

### Hero Section

```html
<section class="hero">
  <div class="hero-content">
    <h1 class="hero-title">Smarter meals. Less waste.</h1>
    <p class="hero-subtitle">
      Your AI-powered cooking companion for delicious, 
      budget-friendly meals
    </p>
    <div class="hero-cta">
      <button class="btn-primary">Download for iOS</button>
      <button class="btn-outline">Learn More</button>
    </div>
  </div>
  <div class="hero-image">
    <img src="app-screenshot.png" alt="Savry App">
  </div>
</section>
```

### Feature Cards

```html
<div class="features-grid">
  <div class="feature-card">
    <div class="feature-icon">🧠</div>
    <h3 class="feature-title">AI Meal Planner</h3>
    <p class="feature-description">
      Smart weekly plans based on your budget and preferences
    </p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">💰</div>
    <h3 class="feature-title">Budget Tracker</h3>
    <p class="feature-description">
      Find deals and save money on groceries
    </p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🛒</div>
    <h3 class="feature-title">Smart Lists</h3>
    <p class="feature-description">
      Organized grocery lists by store and aisle
    </p>
  </div>
</div>
```

---

## ✅ Quick Reference

### Do's ✓
- Use consistent spacing (multiples of 4px)
- Apply soft shadows for depth
- Round all corners (12-20px typical)
- Use brand colors strategically
- Provide clear visual feedback
- Make buttons obvious and clickable
- Use hierarchy for readability

### Don'ts ✗
- Don't use harsh shadows
- Don't mix too many colors
- Don't use tiny text (min 14px)
- Don't forget hover states
- Don't overcrowd the interface
- Don't use generic error messages
- Don't skip loading states

---

## 🎉 Final Notes

This design system creates a **modern, friendly, and professional** aesthetic that:

✅ Feels clean and uncluttered
✅ Uses warm, inviting colors
✅ Has consistent spacing and typography
✅ Provides clear visual hierarchy
✅ Works beautifully on all devices
✅ Matches the iOS app perfectly

Use this guide to maintain consistency across your website and future platforms!

