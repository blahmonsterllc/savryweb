# 📱 iOS App Security Updates - Implementation Guide

**For AI Agent:** This guide contains all changes needed in the iOS app to work with the new server security system.

---

## 🎯 Objective

Update the iOS app to handle new server security features:
- **Simplified tier system:** FREE and PRO only (PREMIUM removed)
- **New rate limits:** FREE: 20/month, PRO: 500/month
- **New error codes:** 403, 429, 503
- **Usage tracking** and upgrade prompts
- Better user experience around limits

---

## 🔄 Major Changes Summary

### 1. Tier System Simplified
- **REMOVED:** PREMIUM tier
- **KEPT:** FREE (20/month) and PRO (500/month)
- **Why:** Simpler choice, better security, industry standard

### 2. Rate Limits
- **FREE users:** 20 AI requests per month
- **PRO users:** 500 AI requests per month
- Both tiers also have IP rate limit: 50 requests/hour

### 3. Server-Side Protection
- Bot detection active (won't affect real iOS users)
- Daily spending caps: $5/user/day, $50/total/day
- IP-based rate limiting

---

## 📋 Changes Required

### Change 1: Update API Error Handling
### Change 2: Add User-Friendly Error Messages
### Change 3: Add Upgrade Prompts
### Change 4: Add Usage Counter Display
### Change 5: Implement Request Debouncing

---

## 🔧 Implementation Details

### Change 1: Update API Error Handling

**File to Modify:** Your main API client (likely `APIClient.swift`, `NetworkManager.swift`, or similar)

**What to Add:**

```swift
// MARK: - User Tier (Simplified - Only FREE and PRO)
enum UserTier: String, Codable {
    case free = "FREE"
    case pro = "PRO"
    // REMOVED: case premium = "PREMIUM"
    
    var displayName: String {
        switch self {
        case .free: return "Free"
        case .pro: return "Pro"
        }
    }
    
    var monthlyLimit: Int {
        switch self {
        case .free: return 20
        case .pro: return 500
        }
    }
}

// MARK: - API Error Types
enum APIError: LocalizedError {
    case unauthorized
    case rateLimitExceeded(message: String, canUpgrade: Bool, usageCount: Int?, limit: Int?)
    case tooManyRequests
    case serviceUnavailable
    case spendingCapReached
    case forbidden(message: String)
    case serverError(message: String)
    case invalidResponse
    case networkError(Error)
    
    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Your session has expired. Please sign in again."
        case .rateLimitExceeded(let message, let canUpgrade, _, _):
            if canUpgrade {
                return "\(message)\n\nUpgrade to Pro for unlimited AI recipes!"
            } else {
                return message
            }
        case .tooManyRequests:
            return "You're making requests too quickly. Please wait a moment and try again."
        case .serviceUnavailable:
            return "AI service is temporarily busy. Please try again in a few minutes."
        case .spendingCapReached:
            return "You've reached your daily AI limit. It will reset tomorrow!"
        case .forbidden(let message):
            return message
        case .serverError(let message):
            return message.isEmpty ? "Server error occurred. Please try again." : message
        case .invalidResponse:
            return "Invalid response from server."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
    
    var shouldShowUpgrade: Bool {
        if case .rateLimitExceeded(_, let canUpgrade, _, _) = self {
            return canUpgrade
        }
        return false
    }
    
    var usageInfo: (count: Int, limit: Int)? {
        if case .rateLimitExceeded(_, _, let count, let limit) = self,
           let count = count, let limit = limit {
            return (count, limit)
        }
        return nil
    }
}

// MARK: - API Response Models
struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let content: T?
    let error: String?
    let message: String?
    let meta: MetaInfo?
    let upgrade: Bool?
    let usageCount: Int?
    let limit: Int?
    
    struct MetaInfo: Codable {
        let tier: String?
        let model: String?
        let usageCount: Int?
        let limit: Int?
        let remainingThisMonth: Int?
    }
}

// MARK: - Enhanced Request Handler
func makeAPIRequest<T: Codable>(
    endpoint: String,
    method: String = "POST",
    body: [String: Any]? = nil,
    completion: @escaping (Result<T, APIError>) -> Void
) {
    guard let url = URL(string: baseURL + endpoint) else {
        completion(.failure(.invalidResponse))
        return
    }
    
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    // Add JWT Bearer token
    if let token = getStoredToken() {
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    
    // Add request body if provided
    if let body = body {
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    }
    
    let task = URLSession.shared.dataTask(with: request) { data, response, error in
        // Handle network errors
        if let error = error {
            DispatchQueue.main.async {
                completion(.failure(.networkError(error)))
            }
            return
        }
        
        guard let httpResponse = response as? HTTPURLResponse,
              let data = data else {
            DispatchQueue.main.async {
                completion(.failure(.invalidResponse))
            }
            return
        }
        
        // Parse error responses
        if httpResponse.statusCode >= 400 {
            let errorResponse = try? JSONDecoder().decode(APIResponse<T>.self, from: data)
            
            DispatchQueue.main.async {
                switch httpResponse.statusCode {
                case 401:
                    // Token expired or invalid - trigger re-login
                    completion(.failure(.unauthorized))
                    
                case 403:
                    // Rate limit or access denied
                    let message = errorResponse?.error ?? errorResponse?.message ?? "Access denied"
                    let canUpgrade = errorResponse?.upgrade ?? false
                    let usageCount = errorResponse?.usageCount
                    let limit = errorResponse?.limit
                    
                    if message.contains("spending") || message.contains("spending cap") {
                        completion(.failure(.spendingCapReached))
                    } else if canUpgrade || message.contains("limit") {
                        completion(.failure(.rateLimitExceeded(
                            message: message,
                            canUpgrade: canUpgrade,
                            usageCount: usageCount,
                            limit: limit
                        )))
                    } else {
                        completion(.failure(.forbidden(message: message)))
                    }
                    
                case 429:
                    // Too many requests - IP rate limit
                    completion(.failure(.tooManyRequests))
                    
                case 503:
                    // Service unavailable - global spending cap
                    completion(.failure(.serviceUnavailable))
                    
                case 500...599:
                    let message = errorResponse?.error ?? errorResponse?.message ?? "Server error"
                    completion(.failure(.serverError(message: message)))
                    
                default:
                    let message = errorResponse?.error ?? "Unknown error"
                    completion(.failure(.serverError(message: message)))
                }
            }
            return
        }
        
        // Parse success response
        do {
            let response = try JSONDecoder().decode(APIResponse<T>.self, from: data)
            
            // Store usage info if provided
            if let meta = response.meta {
                self.updateUsageInfo(meta)
            }
            
            guard let content = response.content else {
                DispatchQueue.main.async {
                    completion(.failure(.invalidResponse))
                }
                return
            }
            
            DispatchQueue.main.async {
                completion(.success(content))
            }
        } catch {
            DispatchQueue.main.async {
                completion(.failure(.invalidResponse))
            }
        }
    }
    
    task.resume()
}

// MARK: - Usage Info Storage
private func updateUsageInfo(_ meta: APIResponse<String>.MetaInfo) {
    if let remaining = meta.remainingThisMonth {
        UserDefaults.standard.set(remaining, forKey: "aiRequestsRemaining")
    }
    if let count = meta.usageCount {
        UserDefaults.standard.set(count, forKey: "aiRequestsUsed")
    }
    if let limit = meta.limit {
        UserDefaults.standard.set(limit, forKey: "aiRequestsLimit")
    }
    if let tier = meta.tier {
        UserDefaults.standard.set(tier, forKey: "userTier")
    }
    
    // Post notification for UI updates
    NotificationCenter.default.post(name: .usageInfoUpdated, object: nil)
}

// MARK: - Notification Names
extension Notification.Name {
    static let usageInfoUpdated = Notification.Name("usageInfoUpdated")
}
```

---

### Change 2: Add Error Handling in UI

**File to Modify:** Your view controllers that make API calls (e.g., `RecipeGeneratorViewController.swift`, `MealPlannerViewController.swift`)

**What to Add:**

```swift
// MARK: - Error Handling
func handleAPIError(_ error: APIError) {
    // Show upgrade prompt if needed
    if error.shouldShowUpgrade {
        showUpgradePrompt(error: error)
        return
    }
    
    // Show appropriate alert for other errors
    let alert = UIAlertController(
        title: getErrorTitle(for: error),
        message: error.localizedDescription,
        preferredStyle: .alert
    )
    
    // Add retry action for transient errors
    if case .tooManyRequests = error {
        alert.addAction(UIAlertAction(title: "Try Again Later", style: .default))
    } else if case .serviceUnavailable = error {
        alert.addAction(UIAlertAction(title: "Try Again", style: .default) { [weak self] _ in
            self?.retryLastRequest()
        })
    } else if case .unauthorized = error {
        alert.addAction(UIAlertAction(title: "Sign In", style: .default) { [weak self] _ in
            self?.showLoginScreen()
        })
    } else {
        alert.addAction(UIAlertAction(title: "OK", style: .default))
    }
    
    present(alert, animated: true)
}

func getErrorTitle(for error: APIError) -> String {
    switch error {
    case .unauthorized:
        return "Session Expired"
    case .rateLimitExceeded:
        return "Limit Reached"
    case .tooManyRequests:
        return "Please Slow Down"
    case .serviceUnavailable:
        return "Service Busy"
    case .spendingCapReached:
        return "Daily Limit Reached"
    case .forbidden:
        return "Access Denied"
    case .serverError, .invalidResponse:
        return "Error"
    case .networkError:
        return "Connection Error"
    }
}

// MARK: - Usage in API Calls
func generateRecipe(prompt: String) {
    showLoadingIndicator()
    
    apiClient.makeAPIRequest(endpoint: "/api/app/chatgpt/generate", body: [
        "prompt": prompt,
        "maxTokens": 2000
    ]) { [weak self] (result: Result<String, APIError>) in
        self?.hideLoadingIndicator()
        
        switch result {
        case .success(let content):
            self?.displayRecipe(content)
            self?.updateUsageDisplay()
            
        case .failure(let error):
            self?.handleAPIError(error)
        }
    }
}
```

---

### Change 3: Add Upgrade Prompt

**Create New File:** `UpgradePromptViewController.swift` (or add to existing file)

**What to Add:**

```swift
// MARK: - Upgrade Prompt
func showUpgradePrompt(error: APIError) {
    let alert = UIAlertController(
        title: "Upgrade to Savry Pro",
        message: nil,
        preferredStyle: .alert
    )
    
    // Customize message based on usage
    var message = ""
    if let usage = error.usageInfo {
        message = "You've used all \(usage.limit) free AI recipes this month.\n\n"
    }
    
    message += """
    Upgrade to Pro for:
    • 500 AI recipes/month
    • Advanced meal planning
    • Budget optimization
    • Store deal finder
    • Priority support
    
    Just $4.99/month
    """
    
    alert.message = message
    
    alert.addAction(UIAlertAction(title: "Upgrade to Pro", style: .default) { [weak self] _ in
        self?.showPaywallOrUpgradeScreen()
    })
    
    alert.addAction(UIAlertAction(title: "Not Now", style: .cancel))
    
    present(alert, animated: true)
}

func showPaywallOrUpgradeScreen() {
    // Navigate to your in-app purchase screen
    // Only show PRO tier products (no PREMIUM)
    
    // StoreKit products to show:
    let products = [
        "com.savry.pro.monthly",   // $4.99/month
        "com.savry.pro.annual"     // $49.99/year (20% discount)
    ]
    
    // Example:
    // let paywallVC = PaywallViewController(products: products)
    // paywallVC.modalPresentationStyle = .fullScreen
    // present(paywallVC, animated: true)
    
    print("Show Pro upgrade screen with products: \(products)")
}
```

---

### Change 4: Add Usage Counter Display

**File to Modify:** Your main view controller or home screen

**What to Add:**

```swift
// MARK: - Usage Counter UI
class UsageCounterView: UIView {
    private let label = UILabel()
    private let progressBar = UIProgressView(progressViewStyle: .default)
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
        updateDisplay()
        
        // Listen for usage updates
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(updateDisplay),
            name: .usageInfoUpdated,
            object: nil
        )
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        addSubview(label)
        addSubview(progressBar)
        
        label.font = .systemFont(ofSize: 12, weight: .medium)
        label.textColor = .secondaryLabel
        label.textAlignment = .center
        
        progressBar.progressTintColor = .systemGreen
        progressBar.trackTintColor = .systemGray5
        
        // Layout
        label.translatesAutoresizingMaskIntoConstraints = false
        progressBar.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: topAnchor),
            label.leadingAnchor.constraint(equalTo: leadingAnchor),
            label.trailingAnchor.constraint(equalTo: trailingAnchor),
            
            progressBar.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 4),
            progressBar.leadingAnchor.constraint(equalTo: leadingAnchor),
            progressBar.trailingAnchor.constraint(equalTo: trailingAnchor),
            progressBar.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }
    
    @objc private func updateDisplay() {
        let used = UserDefaults.standard.integer(forKey: "aiRequestsUsed")
        let limit = UserDefaults.standard.integer(forKey: "aiRequestsLimit")
        let tierString = UserDefaults.standard.string(forKey: "userTier") ?? "FREE"
        let tier = UserTier(rawValue: tierString) ?? .free
        
        switch tier {
        case .pro:
            // Pro users - show generous limit
            let remaining = max(0, limit - used)
            label.text = "Pro: \(remaining) of \(limit) AI recipes remaining this month"
            progressBar.isHidden = false
            progressBar.progress = Float(used) / Float(limit)
            progressBar.progressTintColor = .systemBlue
            label.textColor = .secondaryLabel
            
        case .free:
            // Free users - show limit with upgrade nudge
            if limit > 0 {
                let remaining = max(0, limit - used)
                label.text = "\(remaining) of \(limit) free AI recipes remaining"
                progressBar.isHidden = false
                progressBar.progress = Float(used) / Float(limit)
                
                // Change color when running low
                if remaining == 0 {
                    label.text = "0 of \(limit) - Upgrade to Pro for 500/month!"
                    progressBar.progressTintColor = .systemRed
                    label.textColor = .systemRed
                } else if remaining <= 3 {
                    label.text = "\(remaining) of \(limit) remaining - Upgrade to Pro?"
                    progressBar.progressTintColor = .systemRed
                    label.textColor = .systemRed
                } else if remaining <= 5 {
                    progressBar.progressTintColor = .systemOrange
                    label.textColor = .systemOrange
                } else {
                    progressBar.progressTintColor = .systemGreen
                    label.textColor = .secondaryLabel
                }
            } else {
                label.text = "Loading..."
                progressBar.isHidden = true
            }
        }
    }
}

// MARK: - Add to View Controller
func addUsageCounter() {
    let usageView = UsageCounterView()
    view.addSubview(usageView)
    
    // Add constraints to position it (e.g., below navigation bar)
    usageView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
        usageView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
        usageView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
        usageView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
        usageView.heightAnchor.constraint(equalToConstant: 40)
    ])
}
```

---

### Change 5: Implement Request Debouncing

**File to Modify:** Your API client or view controllers

**What to Add:**

```swift
// MARK: - Request Debouncing
class RequestDebouncer {
    private var lastRequestTime: Date?
    private let minimumInterval: TimeInterval = 2.0 // 2 seconds between requests
    
    func canMakeRequest() -> Bool {
        guard let lastTime = lastRequestTime else {
            lastRequestTime = Date()
            return true
        }
        
        let timeSinceLastRequest = Date().timeIntervalSince(lastTime)
        
        if timeSinceLastRequest >= minimumInterval {
            lastRequestTime = Date()
            return true
        }
        
        return false
    }
    
    func timeUntilNextRequest() -> TimeInterval {
        guard let lastTime = lastRequestTime else {
            return 0
        }
        
        let timeSinceLastRequest = Date().timeIntervalSince(lastTime)
        return max(0, minimumInterval - timeSinceLastRequest)
    }
}

// MARK: - Usage in View Controller
class RecipeGeneratorViewController: UIViewController {
    private let debouncer = RequestDebouncer()
    
    @IBAction func generateButtonTapped(_ sender: UIButton) {
        guard debouncer.canMakeRequest() else {
            let waitTime = Int(ceil(debouncer.timeUntilNextRequest()))
            showAlert(
                title: "Please Wait",
                message: "Please wait \(waitTime) second\(waitTime == 1 ? "" : "s") before generating another recipe."
            )
            return
        }
        
        generateRecipe()
    }
}
```

---

### Change 6: Add Loading States

**What to Add:**

```swift
// MARK: - Loading State Management
class LoadingStateManager {
    private var isLoading = false
    private var loadingView: UIView?
    private weak var parentView: UIView?
    
    init(parentView: UIView) {
        self.parentView = parentView
    }
    
    func showLoading(message: String = "Generating...") {
        guard !isLoading, let parent = parentView else { return }
        
        isLoading = true
        
        // Create overlay
        let overlay = UIView(frame: parent.bounds)
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        overlay.tag = 9999
        
        // Create loading container
        let container = UIView()
        container.backgroundColor = .systemBackground
        container.layer.cornerRadius = 12
        container.translatesAutoresizingMaskIntoConstraints = false
        
        // Add spinner
        let spinner = UIActivityIndicatorView(style: .large)
        spinner.startAnimating()
        spinner.translatesAutoresizingMaskIntoConstraints = false
        
        // Add label
        let label = UILabel()
        label.text = message
        label.font = .systemFont(ofSize: 16, weight: .medium)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        
        container.addSubview(spinner)
        container.addSubview(label)
        overlay.addSubview(container)
        parent.addSubview(overlay)
        
        // Layout
        NSLayoutConstraint.activate([
            container.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            container.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            container.widthAnchor.constraint(equalToConstant: 200),
            container.heightAnchor.constraint(equalToConstant: 120),
            
            spinner.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            spinner.topAnchor.constraint(equalTo: container.topAnchor, constant: 20),
            
            label.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 16),
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -16)
        ])
        
        loadingView = overlay
    }
    
    func hideLoading() {
        isLoading = false
        parentView?.viewWithTag(9999)?.removeFromSuperview()
        loadingView = nil
    }
}

// Usage:
let loadingManager = LoadingStateManager(parentView: view)

func generateRecipe() {
    loadingManager.showLoading(message: "Creating your recipe...")
    
    apiClient.generate { [weak self] result in
        self?.loadingManager.hideLoading()
        // Handle result
    }
}
```

---

## 🧪 Testing Checklist

### Test 1: Normal Request (FREE User)
- [ ] Make a standard API request
- [ ] Should succeed and display results
- [ ] Usage counter should update
- [ ] Should show "X of 20 free AI recipes remaining"

### Test 2: Rate Limit (FREE User - 20/month)
- [ ] Make 20 successful requests
- [ ] Counter should show "0 of 20 remaining"
- [ ] 21st request should show upgrade prompt to PRO
- [ ] Error message should mention "500 recipes/month" for Pro
- [ ] Should NOT mention PREMIUM tier

### Test 3: Normal Request (PRO User)
- [ ] PRO user makes request
- [ ] Should succeed
- [ ] Counter should show "Pro: X of 500 recipes remaining"
- [ ] No upgrade prompts should appear

### Test 4: Rate Limit (PRO User - 500/month)
- [ ] Make 500 successful requests (or test with lower limit)
- [ ] 501st request should show error
- [ ] Should NOT show upgrade prompt (already Pro)
- [ ] Should suggest waiting until next month

### Test 5: Too Many Requests (IP Limit)
- [ ] Make 51 requests rapidly in succession
- [ ] Should get "Please slow down" message
- [ ] Should suggest waiting
- [ ] Affects both FREE and PRO equally

### Test 6: Usage Counter Display
- [ ] FREE user: Shows "X of 20 remaining"
- [ ] PRO user: Shows "Pro: X of 500 remaining"
- [ ] Progress bar updates correctly
- [ ] Color changes: Green → Orange (≤5) → Red (≤3)
- [ ] At 0: Shows upgrade message

### Test 7: Tier Migration
- [ ] User upgrades from FREE to PRO
- [ ] Usage counter updates to show PRO limits
- [ ] No more upgrade prompts appear
- [ ] Limit increases from 20 to 500

### Test 8: Unauthorized
- [ ] Use expired/invalid token
- [ ] Should prompt to sign in again
- [ ] Should redirect to login

### Test 9: Debouncing
- [ ] Try to make two requests within 2 seconds
- [ ] Second request should be blocked
- [ ] Should show "please wait" message

### Test 10: In-App Purchase
- [ ] Free user clicks "Upgrade to Pro"
- [ ] Should show ONLY Pro products (monthly/annual)
- [ ] Should NOT show any PREMIUM products
- [ ] Products: com.savry.pro.monthly, com.savry.pro.annual

---

## 📱 UI/UX Recommendations

### 1. Show Usage Proactively
Display usage counter prominently on the main screen:
- Top of screen below navigation bar
- In settings/profile screen
- Before generating (when clicked)

**Examples:**
```
FREE users:
"15 of 20 free AI recipes remaining this month"

PRO users:
"Pro: 478 of 500 AI recipes remaining this month"
```

### 2. Preemptive Upgrade Prompts (FREE Users Only)
Show upgrade suggestions before hitting limit:

```swift
let remaining = 20 - usedCount

// At 5 remaining
if tier == .free && remaining == 5 {
    showBanner("Only 5 free recipes left! Upgrade to Pro for 500/month")
}

// At 3 remaining
if tier == .free && remaining == 3 {
    showBanner("Running low! Upgrade to Pro for 25x more recipes")
}

// At 0
if tier == .free && remaining == 0 {
    showUpgradePrompt()
}
```

### 3. Clear Error Messages
Use friendly, actionable language:

**❌ BAD:**
- "Error 403: Rate limit exceeded"
- "Access denied"

**✅ GOOD:**
- "You've used all 20 free recipes this month! Upgrade to Pro for 500 recipes/month."
- "Free limit reached. Upgrade to Pro for just $4.99/month!"

### 4. Simplified Upgrade Messaging
Since you only have 2 tiers, keep it simple:

**❌ DON'T:**
- "Upgrade to Pro or Premium"
- "Choose your plan"

**✅ DO:**
- "Upgrade to Pro"
- "Go Pro for $4.99/month"

### 5. Visual Feedback
- Show loading spinners during API calls
- Disable buttons while loading
- Use haptic feedback on success/error
- Color-code tier badges (gray for Free, blue/gold for Pro)

### 6. Tier Badge Display
```swift
// Show tier badge in profile/settings
func getTierBadgeView(tier: UserTier) -> UIView {
    let badge = UILabel()
    badge.font = .systemFont(ofSize: 12, weight: .bold)
    badge.textAlignment = .center
    badge.layer.cornerRadius = 12
    badge.clipsToBounds = true
    badge.textColor = .white
    
    switch tier {
    case .free:
        badge.text = "FREE"
        badge.backgroundColor = .systemGray
    case .pro:
        badge.text = "PRO ⭐"
        badge.backgroundColor = .systemBlue
    }
    
    return badge
}
```

---

## 🎯 Summary of Changes

| Change | Priority | Time | Impact |
|--------|----------|------|--------|
| 0. **Remove PREMIUM Tier** | 🔴 **Critical** | 10 min | Simplifies system |
| 1. Error Handling | 🔴 Critical | 30 min | Prevents crashes |
| 2. Error UI | 🔴 Critical | 20 min | Better UX |
| 3. Upgrade Prompts | 🟡 Important | 15 min | Monetization |
| 4. Usage Counter | 🟡 Important | 30 min | User awareness |
| 5. Debouncing | 🟢 Nice-to-have | 15 min | Prevents abuse |
| 6. Loading States | 🟢 Nice-to-have | 20 min | UX polish |

**Total Time:** 2-3 hours for all changes

---

## 🔄 PREMIUM Tier Removal Checklist

### Code Changes
- [ ] Update `UserTier` enum to only have `.free` and `.pro`
- [ ] Remove any PREMIUM-specific UI elements
- [ ] Remove PREMIUM IAP product IDs
- [ ] Update all tier comparisons (remove PREMIUM checks)
- [ ] Update upgrade prompts to only mention Pro

### StoreKit Changes
- [ ] Remove products:
  - ❌ `com.savry.premium.monthly`
  - ❌ `com.savry.premium.annual`
- [ ] Keep products:
  - ✅ `com.savry.pro.monthly` ($4.99/month)
  - ✅ `com.savry.pro.annual` ($49.99/year)

### UI/UX Changes
- [ ] Remove "Premium" from all UI text
- [ ] Update settings screen (only show Free/Pro)
- [ ] Update upgrade screens (only show Pro option)
- [ ] Update marketing copy to mention 2 tiers

### Testing
- [ ] Test FREE to PRO upgrade flow
- [ ] Verify no PREMIUM mentions in app
- [ ] Test that PRO users see 500/month limit
- [ ] Verify IAP only shows Pro products

---

## 🚀 Deployment Steps

1. **Implement critical changes** (Error handling + UI)
2. **Test thoroughly** with test account
3. **Submit to TestFlight** for beta testing
4. **Monitor crash reports** and errors
5. **Iterate based on feedback**
6. **Submit to App Store**

---

## 📊 Expected Outcomes

After implementing these changes:

✅ **Better UX:** Users understand limits clearly  
✅ **Higher conversions:** Upgrade prompts at right time  
✅ **Fewer errors:** Proper error handling  
✅ **Better retention:** Usage visibility keeps users engaged  
✅ **Protected backend:** Rate limits prevent abuse  

---

## 🆘 Troubleshooting

### Issue: API always returns 403

**Cause:** JWT token might be invalid/expired

**Fix:**
```swift
// Add token refresh logic
if error == .unauthorized {
    refreshToken { success in
        if success {
            retryLastRequest()
        } else {
            showLoginScreen()
        }
    }
}
```

### Issue: Usage counter not updating

**Cause:** Not parsing meta info from response

**Fix:**
```swift
// Make sure you're parsing meta from all API responses
if let meta = response.meta {
    updateUsageInfo(meta)
}
```

### Issue: Upgrade prompt showing for Pro users

**Cause:** Tier not properly detected

**Fix:**
```swift
// Check tier before showing upgrade
let tier = UserDefaults.standard.string(forKey: "userTier") ?? "FREE"
if tier == "FREE" && error.shouldShowUpgrade {
    showUpgradePrompt(error: error)
}
```

---

## ✅ Completion Checklist

### Tier System
- [ ] **Removed PREMIUM tier from enum**
- [ ] **Removed PREMIUM IAP products**
- [ ] **Updated all references from 3 tiers to 2 tiers**
- [ ] **Updated tier display to only show FREE/PRO**

### Core Functionality
- [ ] Updated error handling in API client
- [ ] Added user-friendly error messages
- [ ] Implemented upgrade prompts (Pro only, no Premium)
- [ ] Added usage counter to UI
- [ ] Implemented request debouncing
- [ ] Added loading states

### Testing
- [ ] Tested all error scenarios (401, 403, 429, 503)
- [ ] Tested FREE user rate limit (20/month)
- [ ] Tested PRO user rate limit (500/month)
- [ ] Tested upgrade flow (FREE → PRO only)
- [ ] Tested usage counter for both tiers
- [ ] Verified no PREMIUM mentions anywhere
- [ ] Tested IAP (only Pro products shown)

### UI/UX
- [ ] Updated UI to show usage prominently
- [ ] Added tier badges (Free/Pro)
- [ ] Updated settings screen (removed Premium)
- [ ] Updated upgrade screens (Pro only)
- [ ] Tested on multiple iOS versions

### App Store
- [ ] Updated app description (mention 2 tiers)
- [ ] Updated screenshots (if showing tiers)
- [ ] Updated IAP metadata
- [ ] Ready for TestFlight
- [ ] Ready for App Store submission

---

**Implementation complete when:**
- ✅ All error codes handled properly
- ✅ Users see clear, actionable error messages
- ✅ Upgrade prompts show at right time (Pro only, no Premium)
- ✅ Usage counter displays correctly for FREE (20) and PRO (500)
- ✅ PREMIUM tier completely removed from codebase
- ✅ Only 2 IAP products available (Pro monthly/annual)
- ✅ No crashes or hangs
- ✅ Smooth user experience maintained

---

## 📊 Final Tier Comparison Table

| Feature | FREE | PRO |
|---------|------|-----|
| AI Recipes/Month | 20 | 500 |
| Meal Planning | Basic | Advanced |
| Budget Optimization | ❌ | ✅ |
| Store Deals | ❌ | ✅ |
| Priority Support | ❌ | ✅ |
| **Price** | **Free** | **$4.99/mo** |

**Note:** PREMIUM tier has been removed for security and simplicity.

---

**Questions or issues?** Refer to the server documentation:
- `IOS_API_SECURITY_COMPLETE.md` - Server-side details
- `START_HERE_SECURITY.md` - Quick reference
- `COMPLETE_SECURITY_SUMMARY.md` - Full overview
- `TIER_SYSTEM_SIMPLE.md` - Simplified tier system details
