# 🚀 How to Apply Design System to Any Page

## Quick Guide for Developers

---

## 📝 **Step 1: Import the Design System**

At the top of your component:

```tsx
import '../../../styles/design-system.css'
// Adjust path based on your file location
```

---

## 🎨 **Step 2: Use Design System Classes**

### **Typography:**
```tsx
<h1 className="large-title">Main Page Title</h1>
<h2 className="title-2">Section Header</h2>
<h3 className="title-3">Card Title</h3>
<p className="headline">Important text</p>
<p className="body">Regular text</p>
<span className="caption">Small text</span>
```

### **Buttons:**
```tsx
{/* Primary action - Orange */}
<button className="btn btn-primary">
  Create Recipe
</button>

{/* Secondary action - Teal */}
<button className="btn btn-secondary">
  View Details
</button>

{/* Outline - Teal border */}
<button className="btn btn-outline">
  Cancel
</button>

{/* Small pill */}
<button className="btn-pill">
  Pro
</button>
```

### **Cards:**
```tsx
{/* Standard card */}
<div className="card">
  <h3 className="title-3">Card Title</h3>
  <p className="body">Card content</p>
</div>

{/* Recipe card */}
<div className="recipe-card">
  <img className="recipe-image" src="..." alt="Recipe" />
  <div className="recipe-content">
    <h3 className="recipe-title">Recipe Name</h3>
    <div className="recipe-meta">
      <span>30 mins</span>
      <span>•</span>
      <span>4 servings</span>
    </div>
  </div>
</div>
```

### **Tags/Badges:**
```tsx
{/* Meal type tags */}
<span className="tag tag-breakfast">Breakfast</span>
<span className="tag tag-lunch">Lunch</span>
<span className="tag tag-dinner">Dinner</span>

{/* Difficulty tags */}
<span className="tag tag-easy">Easy</span>
<span className="tag tag-medium">Medium</span>
<span className="tag tag-hard">Hard</span>
```

### **Messages:**
```tsx
{/* Success */}
<div className="message message-success">
  Recipe saved successfully!
</div>

{/* Error */}
<div className="message message-error">
  Failed to save recipe
</div>

{/* Warning */}
<div className="message message-warning">
  Please verify your input
</div>

{/* Info */}
<div className="message message-info">
  Tip: Use fresh ingredients for best results
</div>
```

---

## 🎯 **Step 3: Use CSS Variables**

For custom styling, use the design system variables:

```tsx
<div style={{
  background: 'var(--primary-teal)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-teal)',
  color: 'var(--text-inverse)'
}}>
  Custom styled content
</div>
```

### **Available Variables:**

#### **Colors:**
```css
var(--primary-teal)
var(--accent-orange)
var(--success-green)
var(--breakfast-yellow)
var(--lunch-blue)
var(--dinner-purple)
var(--text-primary)
var(--text-secondary)
var(--background-primary)
var(--background-secondary)
```

#### **Spacing:**
```css
var(--space-2)  /* 8px */
var(--space-3)  /* 12px */
var(--space-4)  /* 16px */
var(--space-6)  /* 24px */
var(--space-8)  /* 32px */
```

#### **Corners:**
```css
var(--radius-sm)   /* 8px */
var(--radius-md)   /* 12px */
var(--radius-lg)   /* 16px */
var(--radius-full) /* 9999px - pills */
```

#### **Shadows:**
```css
var(--shadow-sm)
var(--shadow-md)
var(--shadow-lg)
var(--shadow-teal)
var(--shadow-orange)
```

---

## ✨ **Step 4: Add Animations**

```tsx
{/* Fade in on page load */}
<div className="fade-in">
  Content appears smoothly
</div>

{/* Slide up from bottom */}
<div className="slide-in-up">
  Card slides up elegantly
</div>

{/* Pulse loading state */}
<div className="pulse">
  Loading...
</div>
```

---

## 📋 **Common Patterns**

### **Page Layout:**
```tsx
<div className="page-container">
  <div className="text-center mb-12 fade-in">
    <h1 className="large-title">Page Title</h1>
    <p className="headline" style={{ color: 'var(--text-secondary)' }}>
      Page description
    </p>
  </div>
  
  <div className="recipe-grid">
    {/* Cards here */}
  </div>
</div>
```

### **Form Section:**
```tsx
<div className="card p-8 space-y-6">
  <h2 className="title-2">Form Title</h2>
  
  <div>
    <label className="subheadline font-semibold mb-2 block">
      Field Label
    </label>
    <input className="input-field" placeholder="Enter value..." />
  </div>
  
  <button className="btn btn-primary w-full">
    Submit
  </button>
</div>
```

### **Empty State:**
```tsx
<div className="empty-state">
  <div className="empty-icon">🍳</div>
  <h3 className="empty-title">No Recipes Yet</h3>
  <p className="empty-description">
    Start by adding your first recipe
  </p>
  <button className="btn-primary">Add Recipe</button>
</div>
```

### **Loading State:**
```tsx
<div className="skeleton" style={{ width: '100%', height: '200px' }}>
  {/* Shimmer animation */}
</div>
```

---

## 🎨 **Recipe Page Example**

Complete example using design system:

```tsx
import '../../styles/design-system.css'

export default function RecipePage() {
  return (
    <div style={{ 
      background: 'linear-gradient(180deg, rgba(255, 107, 107, 0.05) 0%, rgba(78, 205, 196, 0.05) 100%)' 
    }}>
      <div className="page-container py-12">
        {/* Header */}
        <div className="text-center mb-12 fade-in">
          <h1 className="large-title">My Recipes</h1>
          <p className="headline" style={{ color: 'var(--text-secondary)' }}>
            Your personal recipe collection
          </p>
        </div>
        
        {/* Recipe Grid */}
        <div className="recipe-grid">
          {recipes.map(recipe => (
            <div key={recipe.id} className="recipe-card">
              <img 
                className="recipe-image" 
                src={recipe.image} 
                alt={recipe.name} 
              />
              <div className="recipe-content">
                <span className="tag tag-breakfast">
                  Breakfast
                </span>
                <h3 className="recipe-title">{recipe.name}</h3>
                <div className="recipe-meta">
                  <span>⏰ {recipe.prepTime}</span>
                  <span>•</span>
                  <span>👥 {recipe.servings}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-outline flex-1">
                    View
                  </button>
                  <button className="btn btn-primary">
                    Cook
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## 🎯 **Do's and Don'ts**

### **✅ DO:**
- Use design system classes when possible
- Use CSS variables for colors
- Follow 4px spacing grid
- Use semantic colors (breakfast=orange, etc.)
- Apply consistent corner radius (12-16px)
- Use soft shadows
- Add hover states
- Include loading states

### **❌ DON'T:**
- Don't use random colors
- Don't use arbitrary spacing (11px, 15px, etc.)
- Don't use harsh shadows
- Don't mix different font sizes randomly
- Don't forget responsive design
- Don't skip animations

---

## 📱 **Mobile-First Approach**

Always start with mobile, then enhance for desktop:

```css
/* Mobile (default) */
.container {
  padding: var(--space-4); /* 16px */
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: var(--space-8); /* 32px */
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    padding: var(--space-12); /* 48px */
  }
}
```

---

## 🔄 **Converting Existing Components**

### **From Generic Tailwind:**
```tsx
// Before
<button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">
  Click Me
</button>

// After (Design System)
<button className="btn btn-secondary">
  Click Me
</button>
```

### **From Inline Styles:**
```tsx
// Before
<div style={{ 
  backgroundColor: '#10B981',
  padding: '16px',
  borderRadius: '8px'
}}>

// After (Design System)
<div style={{
  background: 'var(--primary-teal)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-md)'
}}>
```

---

## ✅ **Quick Checklist for Any Page**

When creating or updating a page:

- [ ] Import `design-system.css`
- [ ] Use `.page-container` for max-width
- [ ] Use gradient background for pages
- [ ] Apply `.large-title` to main heading
- [ ] Use `.card` for content blocks
- [ ] Use `.btn-primary` or `.btn-secondary` for actions
- [ ] Apply meal type colors to recipe cards
- [ ] Use `.tag` classes for labels
- [ ] Add `.fade-in` or `.slide-in-up` animations
- [ ] Use CSS variables for custom styling
- [ ] Test on mobile, tablet, desktop

---

## 🎨 **Color Usage Guide**

### **When to Use Each Color:**

**Teal (Primary):**
- ✅ Main brand elements
- ✅ Links
- ✅ Secondary buttons
- ✅ Prices
- ✅ Success states

**Orange (Accent):**
- ✅ Primary CTAs
- ✅ Save/Bookmark actions
- ✅ Important alerts
- ✅ Pro badges
- ✅ Hot deals

**Green (Success):**
- ✅ Checkmarks
- ✅ Confirmation messages
- ✅ Progress indicators
- ✅ Healthy/organic labels

**Meal Type Colors:**
- 🍳 Breakfast: Orange (#FFA726)
- 🥗 Lunch: Blue (#42A5F5)
- 🍽️ Dinner: Purple (#AB47BC)
- 🍪 Snack: Green (#66BB6A)
- 🍰 Dessert: Pink (#EC407A)

---

## 📚 **Full Design System Reference**

See `SAVRY_DESIGN_SYSTEM.md` for complete specifications including:
- Complete color palette
- Typography scale
- Spacing system
- Component library
- Layout patterns
- Animation examples
- Brand guidelines
- Voice & tone

---

## 🎉 **You're Ready!**

With the design system in place, you can now:
1. ✅ Create new pages that match iOS automatically
2. ✅ Update existing pages with consistent styling
3. ✅ Maintain brand consistency effortlessly
4. ✅ Develop faster with reusable components
5. ✅ Scale your design as the app grows

**Your website and iOS app now have perfect design synergy!** 🎨📱💻✨




