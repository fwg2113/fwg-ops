/**
 * ============================================================================
 * FWG COMMERCIAL WRAPS ESTIMATOR - fwg-wraps.js
 * Frederick Window Graphics
 * ============================================================================
 * 
 * Customer-facing estimator for commercial vehicle wraps.
 * Collects vehicle info, project type, design scenario, and customer details.
 * Submits to FWG Dashboard via Apps Script web app.
 * 
 * ============================================================================
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const CONFIG = {
    // Apps Script Web App URL (UPDATE THIS after deploying)
    apiUrl: 'https://fwg-ops.vercel.app',
    
    // Vehicle Categories
    vehicleCategories: [
      { key: 'SEDAN_COUPE', label: 'Sedan / Coupe', icon: '🚗', examples: 'Camry, Accord, Mustang' },
      { key: 'SMALL_SUV', label: 'Small SUV / Crossover', icon: '🚙', examples: 'RAV4, CR-V, Bronco Sport' },
      { key: 'LARGE_SUV', label: 'Large SUV', icon: '🚙', examples: 'Tahoe, Expedition, Suburban' },
      { key: 'PICKUP_STD', label: 'Pickup Truck', icon: '🛻', examples: 'F-150, Silverado, RAM 1500' },
      { key: 'PICKUP_HD', label: 'Heavy Duty Pickup', icon: '🛻', examples: 'F-250, F-350, 3500 Dually' },
      { key: 'CARGO_VAN_SM', label: 'Small Cargo Van', icon: '🚐', examples: 'Transit Connect, ProMaster City' },
      { key: 'CARGO_VAN_LG', label: 'Full Size Cargo Van', icon: '🚐', examples: 'Sprinter, Transit, ProMaster' },
      { key: 'BOX_TRUCK_SM', label: 'Box Truck (10-16ft)', icon: '🚚', examples: 'Isuzu NPR, Hino' },
      { key: 'BOX_TRUCK_LG', label: 'Box Truck (20-26ft)', icon: '🚚', examples: 'Moving truck size' },
      { key: 'TRAILER', label: 'Trailer', icon: '📦', examples: 'Enclosed trailers' }
    ],
    
    // Project Types
    projectTypes: [
      { 
        key: 'FULL_WRAP', 
        label: 'Full Wrap', 
        description: 'Complete vehicle coverage with printed graphics (90%+ of vehicle)',
        icon: '🎨'
      },
      { 
        key: 'PARTIAL_WRAP', 
        label: 'Partial Wrap', 
        description: 'Strategic coverage - hood, doors, tailgate, etc. (30-70% of vehicle)',
        icon: '✨'
      },
      { 
        key: 'LETTERING', 
        label: 'Lettering & Graphics', 
        description: 'Vinyl lettering, logos, decals - no full panels',
        icon: '📝'
      }
    ],
    
    // Design Scenarios
    designScenarios: [
      {
        key: 'FLEET_MATCH',
        label: 'Fleet Match',
        description: 'I have existing wrapped vehicles and design files to match',
        designFee: false,
        uploadRequired: true,
        icon: '🔄'
      },
      {
        key: 'PRINT_READY',
        label: 'Print-Ready Artwork',
        description: 'I have complete print-ready design files (AI, PDF, EPS)',
        designFee: false,
        uploadRequired: true,
        icon: '📁'
      },
      {
        key: 'LOGO_VISION',
        label: 'Logo + Vision',
        description: 'I have my logo and brand guidelines - need design work',
        designFee: true,
        uploadRequired: true,
        icon: '💡'
      },
      {
        key: 'LOGO_ONLY',
        label: 'Logo Only',
        description: 'I have my logo but no design direction yet',
        designFee: true,
        uploadRequired: true,
        icon: '🏷️'
      },
      {
        key: 'FROM_SCRATCH',
        label: 'Start from Scratch',
        description: 'I need everything - may need logo design too',
        designFee: true,
        uploadRequired: false,
        icon: '🚀'
      }
    ],
    
    // Pricing Matrix (min/max by vehicle × project)
    // These are fallbacks - ideally loaded from API
    pricing: {
      'SEDAN_COUPE': { 'FULL_WRAP': [2500, 3500], 'PARTIAL_WRAP': [1200, 2200], 'LETTERING': [300, 800] },
      'SMALL_SUV': { 'FULL_WRAP': [2800, 4000], 'PARTIAL_WRAP': [1400, 2500], 'LETTERING': [350, 900] },
      'LARGE_SUV': { 'FULL_WRAP': [3500, 5000], 'PARTIAL_WRAP': [1800, 3200], 'LETTERING': [400, 1000] },
      'PICKUP_STD': { 'FULL_WRAP': [3200, 4500], 'PARTIAL_WRAP': [1600, 2800], 'LETTERING': [400, 1000] },
      'PICKUP_HD': { 'FULL_WRAP': [4000, 5500], 'PARTIAL_WRAP': [2000, 3500], 'LETTERING': [450, 1200] },
      'CARGO_VAN_SM': { 'FULL_WRAP': [3500, 5000], 'PARTIAL_WRAP': [1800, 3200], 'LETTERING': [500, 1200] },
      'CARGO_VAN_LG': { 'FULL_WRAP': [5000, 8000], 'PARTIAL_WRAP': [2500, 4500], 'LETTERING': [600, 1500] },
      'BOX_TRUCK_SM': { 'FULL_WRAP': [5500, 8500], 'PARTIAL_WRAP': [2800, 5000], 'LETTERING': [700, 1800] },
      'BOX_TRUCK_LG': { 'FULL_WRAP': [8000, 14000], 'PARTIAL_WRAP': [4000, 8000], 'LETTERING': [900, 2500] },
      'TRAILER': { 'FULL_WRAP': [3000, 10000], 'PARTIAL_WRAP': [1500, 5000], 'LETTERING': [400, 1500] }
    },
    
    // Design Fees by vehicle × scenario (only for scenarios that require design)
    designFees: {
      'SEDAN_COUPE': { 'LOGO_VISION': [200, 400], 'LOGO_ONLY': [300, 600], 'FROM_SCRATCH': [500, 1000] },
      'SMALL_SUV': { 'LOGO_VISION': [200, 400], 'LOGO_ONLY': [300, 600], 'FROM_SCRATCH': [500, 1000] },
      'LARGE_SUV': { 'LOGO_VISION': [250, 500], 'LOGO_ONLY': [400, 750], 'FROM_SCRATCH': [600, 1200] },
      'PICKUP_STD': { 'LOGO_VISION': [250, 500], 'LOGO_ONLY': [400, 750], 'FROM_SCRATCH': [600, 1200] },
      'PICKUP_HD': { 'LOGO_VISION': [300, 600], 'LOGO_ONLY': [450, 900], 'FROM_SCRATCH': [700, 1400] },
      'CARGO_VAN_SM': { 'LOGO_VISION': [300, 600], 'LOGO_ONLY': [450, 900], 'FROM_SCRATCH': [700, 1400] },
      'CARGO_VAN_LG': { 'LOGO_VISION': [400, 800], 'LOGO_ONLY': [600, 1200], 'FROM_SCRATCH': [900, 1800] },
      'BOX_TRUCK_SM': { 'LOGO_VISION': [500, 1000], 'LOGO_ONLY': [750, 1500], 'FROM_SCRATCH': [1200, 2400] },
      'BOX_TRUCK_LG': { 'LOGO_VISION': [700, 1400], 'LOGO_ONLY': [1000, 2000], 'FROM_SCRATCH': [1500, 3000] },
      'TRAILER': { 'LOGO_VISION': [300, 800], 'LOGO_ONLY': [400, 1000], 'FROM_SCRATCH': [600, 1500] }
    }
  };

  // ============================================================================
  // FETCHED DATA (from API - overrides CONFIG fallbacks)
  // ============================================================================
  
  let fetchedData = {
    vehicleCategories: null,
    projectTypes: null,
    designScenarios: null,
    pricingMatrix: null,
    designFees: null
  };

  // ============================================================================
  // STATE
  // ============================================================================
  
  let state = {
    currentStep: 1,
    vehicleCategory: null,
    vehicleYear: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleCount: 1,
    projectType: null,
    designScenario: null,
    priceMin: 0,
    priceMax: 0,
    designFeeMin: 0,
    designFeeMax: 0,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    companyName: '',
    website: '',
    preferredContact: '',
    visionDescription: '',
    timeline: '',
    budgetRange: ''
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  async function init() {
    const container = document.getElementById('fwg-estimator');
    if (!container) {
      console.error('FWG Estimator: Container #fwg-estimator not found');
      return;
    }
    
    // Render immediately with fallback data
    renderEstimator(container);
    showStep(1);
    
    // Fetch dynamic data in background
    await fetchBulkData();
  }
  
  /**
   * Fetch dynamic data from Apps Script API
   * Updates vehicleCategories, projectTypes, designScenarios, and pricing
   */
  async function fetchBulkData() {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/api/estimator/config`, {
        method: 'GET',
        cache: 'no-cache'
      });
      
      const result = await response.json();
      
      if (result.ok) {
        // Store fetched data
        if (result.vehicleCategories && result.vehicleCategories.length > 0) {
          fetchedData.vehicleCategories = result.vehicleCategories;
          console.log('✓ Loaded', result.vehicleCategories.length, 'vehicle categories from API');
        }
        
        if (result.projectTypes && result.projectTypes.length > 0) {
          fetchedData.projectTypes = result.projectTypes;
          console.log('✓ Loaded', result.projectTypes.length, 'project types from API');
        }
        
        if (result.designScenarios && result.designScenarios.length > 0) {
          fetchedData.designScenarios = result.designScenarios;
          console.log('✓ Loaded', result.designScenarios.length, 'design scenarios from API');
        }
        
        if (result.pricingMatrix && result.pricingMatrix.length > 0) {
          fetchedData.pricingMatrix = result.pricingMatrix;
          console.log('✓ Loaded', result.pricingMatrix.length, 'pricing entries from API');
        }
        
        if (result.designFees && result.designFees.length > 0) {
          fetchedData.designFees = result.designFees;
          console.log('✓ Loaded', result.designFees.length, 'design fee entries from API');
        }
        
        // Re-render step 1 with fresh data if we got vehicle categories
        if (fetchedData.vehicleCategories) {
          const step1 = document.querySelector('.fwg-step[data-step="1"]');
          if (step1) {
            renderStep1Content(step1);
          }
        }
        
      } else {
        console.warn('FWG Estimator: API returned error, using fallback data');
      }
      
    } catch (error) {
      console.warn('FWG Estimator: Could not fetch dynamic data, using fallbacks:', error.message);
    }
  }

  // ============================================================================
  // RENDERING
  // ============================================================================
  
  function renderEstimator(container) {
    container.innerHTML = `
      <div class="fwg-estimator">
        <!-- Progress Bar -->
        <div class="fwg-progress">
          <div class="fwg-progress-bar">
            <div class="fwg-progress-fill" id="progress-fill"></div>
          </div>
          <div class="fwg-progress-steps">
            <div class="fwg-progress-step active" data-step="1">
              <span class="step-number">1</span>
              <span class="step-label">Vehicle</span>
            </div>
            <div class="fwg-progress-step" data-step="2">
              <span class="step-number">2</span>
              <span class="step-label">Project</span>
            </div>
            <div class="fwg-progress-step" data-step="3">
              <span class="step-number">3</span>
              <span class="step-label">Design</span>
            </div>
            <div class="fwg-progress-step" data-step="4">
              <span class="step-number">4</span>
              <span class="step-label">Details</span>
            </div>
            <div class="fwg-progress-step" data-step="5">
              <span class="step-number">5</span>
              <span class="step-label">Submit</span>
            </div>
          </div>
        </div>
        
        <!-- Steps Container -->
        <div class="fwg-steps-container">
          ${renderStep1()}
          ${renderStep2()}
          ${renderStep3()}
          ${renderStep4()}
          ${renderStep5()}
        </div>
        
        <!-- Navigation -->
        <div class="fwg-nav">
          <button class="fwg-btn fwg-btn-secondary" id="btn-back" onclick="FWGEstimator.prevStep()">
            ← Back
          </button>
          <button class="fwg-btn fwg-btn-primary" id="btn-next" onclick="FWGEstimator.nextStep()">
            Continue →
          </button>
        </div>
      </div>
    `;
  }
  
  function renderStep1() {
    let vehicleCards = CONFIG.vehicleCategories.map(v => `
      <div class="fwg-card fwg-vehicle-card" data-key="${v.key}" onclick="FWGEstimator.selectVehicle('${v.key}')">
        <div class="fwg-card-icon">${v.icon}</div>
        <div class="fwg-card-label">${v.label}</div>
        <div class="fwg-card-examples">${v.examples}</div>
      </div>
    `).join('');
    
    return `
      <div class="fwg-step" id="step-1">
        <h2 class="fwg-step-title">What type of vehicle?</h2>
        <p class="fwg-step-subtitle">Select the category that best matches your vehicle</p>
        
        <div class="fwg-vehicle-grid">
          ${vehicleCards}
        </div>
        
        <div class="fwg-vehicle-details" id="vehicle-details" style="display: none;">
          <h3>Vehicle Details (Optional)</h3>
          <div class="fwg-form-row">
            <div class="fwg-form-group">
              <label>Year</label>
              <input type="text" id="vehicle-year" placeholder="2024" maxlength="4" onchange="FWGEstimator.updateVehicle()">
            </div>
            <div class="fwg-form-group">
              <label>Make</label>
              <input type="text" id="vehicle-make" placeholder="Ford" onchange="FWGEstimator.updateVehicle()">
            </div>
            <div class="fwg-form-group">
              <label>Model</label>
              <input type="text" id="vehicle-model" placeholder="Transit" onchange="FWGEstimator.updateVehicle()">
            </div>
          </div>
          
          <div class="fwg-form-group">
            <label>How many vehicles?</label>
            <div class="fwg-quantity-selector">
              <button type="button" class="fwg-qty-btn" onclick="FWGEstimator.adjustQuantity(-1)">−</button>
              <input type="number" id="vehicle-count" value="1" min="1" max="50" onchange="FWGEstimator.updateVehicle()">
              <button type="button" class="fwg-qty-btn" onclick="FWGEstimator.adjustQuantity(1)">+</button>
            </div>
            <p class="fwg-form-help">Fleet pricing available for 3+ vehicles</p>
          </div>
        </div>
      </div>
    `;
  }
  
  function renderStep2() {
    let projectCards = CONFIG.projectTypes.map(p => `
      <div class="fwg-card fwg-project-card" data-key="${p.key}" onclick="FWGEstimator.selectProject('${p.key}')">
        <div class="fwg-card-icon">${p.icon}</div>
        <div class="fwg-card-label">${p.label}</div>
        <div class="fwg-card-description">${p.description}</div>
      </div>
    `).join('');
    
    return `
      <div class="fwg-step" id="step-2">
        <h2 class="fwg-step-title">What type of project?</h2>
        <p class="fwg-step-subtitle">This helps us estimate pricing and timeline</p>
        
        <div class="fwg-project-grid">
          ${projectCards}
        </div>
        
        <div class="fwg-price-preview" id="price-preview-2" style="display: none;">
          <div class="fwg-price-label">Estimated Range</div>
          <div class="fwg-price-range" id="price-range-2">$0 - $0</div>
          <div class="fwg-price-note">Per vehicle • Design fees may apply</div>
        </div>
      </div>
    `;
  }
  
  function renderStep3() {
    let scenarioCards = CONFIG.designScenarios.map(s => `
      <div class="fwg-card fwg-scenario-card" data-key="${s.key}" onclick="FWGEstimator.selectScenario('${s.key}')">
        <div class="fwg-card-icon">${s.icon}</div>
        <div class="fwg-card-label">${s.label}</div>
        <div class="fwg-card-description">${s.description}</div>
        ${s.designFee ? '<div class="fwg-card-badge">Design fee applies</div>' : ''}
      </div>
    `).join('');
    
    return `
      <div class="fwg-step" id="step-3">
        <h2 class="fwg-step-title">Tell us about your artwork</h2>
        <p class="fwg-step-subtitle">This determines if design services are needed</p>
        
        <div class="fwg-scenario-grid">
          ${scenarioCards}
        </div>
        
        <div class="fwg-price-preview" id="price-preview-3" style="display: none;">
          <div class="fwg-price-breakdown">
            <div class="fwg-price-line">
              <span>Wrap/Graphics</span>
              <span id="wrap-price-range">$0 - $0</span>
            </div>
            <div class="fwg-price-line" id="design-fee-line" style="display: none;">
              <span>Design Fee</span>
              <span id="design-fee-range">$0 - $0</span>
            </div>
            <div class="fwg-price-line fwg-price-total">
              <span>Total Estimate</span>
              <span id="total-price-range">$0 - $0</span>
            </div>
          </div>
          <div class="fwg-price-note" id="vehicle-count-note"></div>
        </div>
      </div>
    `;
  }
  
  function renderStep4() {
    return `
      <div class="fwg-step" id="step-4">
        <h2 class="fwg-step-title">Tell us about your project</h2>
        <p class="fwg-step-subtitle">Help us understand your vision</p>
        
        <div class="fwg-form-group">
          <label>Describe your vision <span class="fwg-optional">(optional)</span></label>
          <textarea id="vision-description" rows="4" placeholder="What do you want your vehicle to communicate? Any colors, styles, or examples you like?" onchange="FWGEstimator.updateDetails()"></textarea>
        </div>
        
        <div class="fwg-form-row">
          <div class="fwg-form-group">
            <label>Timeline</label>
            <select id="timeline" onchange="FWGEstimator.updateDetails()">
              <option value="">When do you need it?</option>
              <option value="ASAP">ASAP - Rush</option>
              <option value="2-3 weeks">2-3 weeks</option>
              <option value="1 month">About a month</option>
              <option value="Flexible">Flexible / No rush</option>
            </select>
          </div>
          <div class="fwg-form-group">
            <label>Budget Range <span class="fwg-optional">(optional)</span></label>
            <select id="budget-range" onchange="FWGEstimator.updateDetails()">
              <option value="">Select budget range</option>
              <option value="Under $2,000">Under $2,000</option>
              <option value="$2,000 - $5,000">$2,000 - $5,000</option>
              <option value="$5,000 - $10,000">$5,000 - $10,000</option>
              <option value="$10,000 - $20,000">$10,000 - $20,000</option>
              <option value="$20,000+">$20,000+</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }
  
  function renderStep5() {
    return `
      <div class="fwg-step" id="step-5">
        <h2 class="fwg-step-title">Your Contact Information</h2>
        <p class="fwg-step-subtitle">We'll reach out to discuss your project</p>
        
        <div class="fwg-form-row">
          <div class="fwg-form-group">
            <label>Your Name <span class="fwg-required">*</span></label>
            <input type="text" id="customer-name" placeholder="John Smith" required onchange="FWGEstimator.updateContact()">
          </div>
          <div class="fwg-form-group">
            <label>Company Name <span class="fwg-optional">(optional)</span></label>
            <input type="text" id="company-name" placeholder="Smith Plumbing LLC" onchange="FWGEstimator.updateContact()">
          </div>
        </div>
        
        <div class="fwg-form-row">
          <div class="fwg-form-group">
            <label>Email <span class="fwg-required">*</span></label>
            <input type="email" id="customer-email" placeholder="john@example.com" required onchange="FWGEstimator.updateContact()">
          </div>
          <div class="fwg-form-group">
            <label>Phone <span class="fwg-required">*</span></label>
            <input type="tel" id="customer-phone" placeholder="(240) 555-1234" required onchange="FWGEstimator.updateContact()">
          </div>
        </div>
        
        <div class="fwg-form-group">
          <label>Website <span class="fwg-optional">(optional)</span></label>
          <input type="text" id="website" placeholder="www.smithplumbing.com" onchange="FWGEstimator.updateContact()">
        </div>
        
        <div class="fwg-form-group">
          <label>How would you like us to contact you?</label>
          <div class="fwg-contact-options">
            <label class="fwg-radio-card">
              <input type="radio" name="preferred-contact" value="Text Message" onchange="FWGEstimator.updateContact()">
              <span class="fwg-radio-icon">💬</span>
              <span class="fwg-radio-label">Text</span>
            </label>
            <label class="fwg-radio-card">
              <input type="radio" name="preferred-contact" value="Phone Call" onchange="FWGEstimator.updateContact()">
              <span class="fwg-radio-icon">📞</span>
              <span class="fwg-radio-label">Call</span>
            </label>
            <label class="fwg-radio-card">
              <input type="radio" name="preferred-contact" value="Email" onchange="FWGEstimator.updateContact()">
              <span class="fwg-radio-icon">✉️</span>
              <span class="fwg-radio-label">Email</span>
            </label>
          </div>
        </div>
        
        <!-- Summary -->
        <div class="fwg-summary" id="final-summary">
          <h3>Your Estimate Summary</h3>
          <div class="fwg-summary-content" id="summary-content"></div>
        </div>
        
        <!-- Submit Button -->
        <div class="fwg-submit-container">
          <button class="fwg-btn fwg-btn-submit" id="btn-submit" onclick="FWGEstimator.submit()">
            Get My Free Quote →
          </button>
          <p class="fwg-submit-note">
            We'll review your request and get back to you within 1 business day.
          </p>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // STEP NAVIGATION
  // ============================================================================
  
  function showStep(stepNum) {
    state.currentStep = stepNum;
    
    // Hide all steps
    document.querySelectorAll('.fwg-step').forEach(step => {
      step.classList.remove('active');
    });
    
    // Show current step
    const currentStep = document.getElementById(`step-${stepNum}`);
    if (currentStep) {
      currentStep.classList.add('active');
    }
    
    // Update progress bar
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
      progressFill.style.width = `${(stepNum / 5) * 100}%`;
    }
    
    // Update progress steps
    document.querySelectorAll('.fwg-progress-step').forEach(step => {
      const sNum = parseInt(step.dataset.step);
      step.classList.remove('active', 'completed');
      if (sNum === stepNum) {
        step.classList.add('active');
      } else if (sNum < stepNum) {
        step.classList.add('completed');
      }
    });
    
    // Update nav buttons
    const backBtn = document.getElementById('btn-back');
    const nextBtn = document.getElementById('btn-next');
    
    if (backBtn) {
      backBtn.style.display = stepNum === 1 ? 'none' : 'block';
    }
    
    if (nextBtn) {
      if (stepNum === 5) {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.style.display = 'block';
        nextBtn.disabled = !canProceed(stepNum);
      }
    }
    
    // Step-specific actions
    if (stepNum === 5) {
      updateSummary();
    }
  }
  
  function nextStep() {
    if (canProceed(state.currentStep)) {
      showStep(state.currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  
  function prevStep() {
    if (state.currentStep > 1) {
      showStep(state.currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  
  function canProceed(stepNum) {
    switch (stepNum) {
      case 1:
        return state.vehicleCategory !== null;
      case 2:
        return state.projectType !== null;
      case 3:
        return state.designScenario !== null;
      case 4:
        return true; // Optional fields
      case 5:
        return state.customerName && state.customerEmail && state.customerPhone;
      default:
        return false;
    }
  }

  // ============================================================================
  // SELECTIONS
  // ============================================================================
  
  function selectVehicle(key) {
    state.vehicleCategory = key;
    
    // Update UI
    document.querySelectorAll('.fwg-vehicle-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.key === key);
    });
    
    // Show vehicle details
    document.getElementById('vehicle-details').style.display = 'block';
    
    // Update pricing if project already selected
    if (state.projectType) {
      updatePricing();
    }
    
    // Enable next button
    document.getElementById('btn-next').disabled = false;
  }
  
  function selectProject(key) {
    state.projectType = key;
    
    // Update UI
    document.querySelectorAll('.fwg-project-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.key === key);
    });
    
    // Update pricing
    updatePricing();
    
    // Show price preview
    document.getElementById('price-preview-2').style.display = 'block';
    
    // Enable next button
    document.getElementById('btn-next').disabled = false;
  }
  
  function selectScenario(key) {
    state.designScenario = key;
    
    // Update UI
    document.querySelectorAll('.fwg-scenario-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.key === key);
    });
    
    // Update pricing with design fees
    updatePricingWithDesign();
    
    // Show price preview
    document.getElementById('price-preview-3').style.display = 'block';
    
    // Enable next button
    document.getElementById('btn-next').disabled = false;
  }
  
  function adjustQuantity(delta) {
    const input = document.getElementById('vehicle-count');
    let value = parseInt(input.value) || 1;
    value = Math.max(1, Math.min(50, value + delta));
    input.value = value;
    state.vehicleCount = value;
    updatePricingWithDesign();
  }
  
  function updateVehicle() {
    state.vehicleYear = document.getElementById('vehicle-year').value;
    state.vehicleMake = document.getElementById('vehicle-make').value;
    state.vehicleModel = document.getElementById('vehicle-model').value;
    state.vehicleCount = parseInt(document.getElementById('vehicle-count').value) || 1;
    
    if (state.designScenario) {
      updatePricingWithDesign();
    }
  }
  
  function updateDetails() {
    state.visionDescription = document.getElementById('vision-description').value;
    state.timeline = document.getElementById('timeline').value;
    state.budgetRange = document.getElementById('budget-range').value;
  }
  
  function updateContact() {
    state.customerName = document.getElementById('customer-name').value;
    state.customerEmail = document.getElementById('customer-email').value;
    state.customerPhone = document.getElementById('customer-phone').value;
    state.companyName = document.getElementById('company-name').value;
    state.website = document.getElementById('website').value;
    
    const preferredContact = document.querySelector('input[name="preferred-contact"]:checked');
    state.preferredContact = preferredContact ? preferredContact.value : '';
    
    // Update summary
    updateSummary();
  }

  // ============================================================================
  // PRICING
  // ============================================================================
  
  function updatePricing() {
    if (!state.vehicleCategory || !state.projectType) return;
    
    // Try fetched pricing first, fall back to CONFIG
    let priceFound = false;
    
    if (fetchedData.pricingMatrix) {
      const match = fetchedData.pricingMatrix.find(p => 
        p.category_key === state.vehicleCategory && p.project_key === state.projectType
      );
      if (match) {
        state.priceMin = match.price_min || match.min || 0;
        state.priceMax = match.price_max || match.max || 0;
        priceFound = true;
      }
    }
    
    // Fallback to hardcoded CONFIG
    if (!priceFound) {
      const prices = CONFIG.pricing[state.vehicleCategory]?.[state.projectType];
      if (prices) {
        state.priceMin = prices[0];
        state.priceMax = prices[1];
      }
    }
    
    // Update display
    const priceRange = document.getElementById('price-range-2');
    if (priceRange) {
      priceRange.textContent = formatPriceRange(state.priceMin, state.priceMax);
    }
  }
  
  function updatePricingWithDesign() {
    if (!state.vehicleCategory || !state.projectType || !state.designScenario) return;
    
    // Try fetched pricing first, fall back to CONFIG
    let priceFound = false;
    
    if (fetchedData.pricingMatrix) {
      const match = fetchedData.pricingMatrix.find(p => 
        p.category_key === state.vehicleCategory && p.project_key === state.projectType
      );
      if (match) {
        state.priceMin = match.price_min || match.min || 0;
        state.priceMax = match.price_max || match.max || 0;
        priceFound = true;
      }
    }
    
    // Fallback to hardcoded CONFIG
    if (!priceFound) {
      const prices = CONFIG.pricing[state.vehicleCategory]?.[state.projectType];
      if (prices) {
        state.priceMin = prices[0];
        state.priceMax = prices[1];
      }
    }
    
    // Get design fee if applicable
    const scenarios = fetchedData.designScenarios || CONFIG.designScenarios;
    const scenario = scenarios.find(s => s.key === state.designScenario);
    
    if (scenario && (scenario.designFee || scenario.design_fee)) {
      let feeFound = false;
      
      // Try fetched design fees first
      if (fetchedData.designFees) {
        const match = fetchedData.designFees.find(f => 
          f.category_key === state.vehicleCategory && f.scenario_key === state.designScenario
        );
        if (match) {
          state.designFeeMin = match.design_fee_min || match.min || 0;
          state.designFeeMax = match.design_fee_max || match.max || 0;
          feeFound = true;
        }
      }
      
      // Fallback to hardcoded CONFIG
      if (!feeFound) {
        const fees = CONFIG.designFees[state.vehicleCategory]?.[state.designScenario];
        if (fees) {
          state.designFeeMin = fees[0];
          state.designFeeMax = fees[1];
        }
      }
    } else {
      state.designFeeMin = 0;
      state.designFeeMax = 0;
    }
    
    // Update display
    const wrapRange = document.getElementById('wrap-price-range');
    const designFeeLine = document.getElementById('design-fee-line');
    const designFeeRange = document.getElementById('design-fee-range');
    const totalRange = document.getElementById('total-price-range');
    const vehicleNote = document.getElementById('vehicle-count-note');
    
    if (wrapRange) {
      wrapRange.textContent = formatPriceRange(state.priceMin, state.priceMax);
    }
    
    if (designFeeLine && designFeeRange) {
      if (state.designFeeMin > 0) {
        designFeeLine.style.display = 'flex';
        designFeeRange.textContent = formatPriceRange(state.designFeeMin, state.designFeeMax);
      } else {
        designFeeLine.style.display = 'none';
      }
    }
    
    if (totalRange) {
      const totalMin = (state.priceMin * state.vehicleCount) + state.designFeeMin;
      const totalMax = (state.priceMax * state.vehicleCount) + state.designFeeMax;
      totalRange.textContent = formatPriceRange(totalMin, totalMax);
    }
    
    if (vehicleNote) {
      if (state.vehicleCount > 1) {
        vehicleNote.textContent = `For ${state.vehicleCount} vehicles • Fleet discounts may apply`;
      } else {
        vehicleNote.textContent = 'Per vehicle pricing';
      }
    }
  }
  
  function formatPriceRange(min, max) {
    const formatNum = (n) => '$' + n.toLocaleString();
    return `${formatNum(min)} - ${formatNum(max)}`;
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  function updateSummary() {
    const container = document.getElementById('summary-content');
    if (!container) return;
    
    const vehicle = CONFIG.vehicleCategories.find(v => v.key === state.vehicleCategory);
    const project = CONFIG.projectTypes.find(p => p.key === state.projectType);
    const scenario = CONFIG.designScenarios.find(s => s.key === state.designScenario);
    
    const vehicleDesc = state.vehicleYear || state.vehicleMake || state.vehicleModel
      ? `${state.vehicleYear} ${state.vehicleMake} ${state.vehicleModel}`.trim()
      : '';
    
    const totalMin = (state.priceMin * state.vehicleCount) + state.designFeeMin;
    const totalMax = (state.priceMax * state.vehicleCount) + state.designFeeMax;
    
    container.innerHTML = `
      <div class="fwg-summary-row">
        <span class="fwg-summary-label">Vehicle</span>
        <span class="fwg-summary-value">
          ${vehicle ? vehicle.label : '-'}
          ${vehicleDesc ? `<br><small>${vehicleDesc}</small>` : ''}
          ${state.vehicleCount > 1 ? `<br><small>× ${state.vehicleCount} vehicles</small>` : ''}
        </span>
      </div>
      <div class="fwg-summary-row">
        <span class="fwg-summary-label">Project</span>
        <span class="fwg-summary-value">${project ? project.label : '-'}</span>
      </div>
      <div class="fwg-summary-row">
        <span class="fwg-summary-label">Design</span>
        <span class="fwg-summary-value">${scenario ? scenario.label : '-'}</span>
      </div>
      <div class="fwg-summary-row fwg-summary-total">
        <span class="fwg-summary-label">Estimated Total</span>
        <span class="fwg-summary-value">${formatPriceRange(totalMin, totalMax)}</span>
      </div>
    `;
  }

  // ============================================================================
  // SUBMISSION
  // ============================================================================
  
  async function submit() {
    // Validate
    if (!state.customerName || !state.customerEmail || !state.customerPhone) {
      alert('Please fill in all required fields.');
      return;
    }
    
    // Disable button
    const submitBtn = document.getElementById('btn-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="fwg-spinner"></span> Submitting...';
    
    // Build submission data
    const data = {
      source: 'estimator',
      customer_name: state.customerName,
      customer_email: state.customerEmail,
      customer_phone: state.customerPhone,
      preferred_contact: state.preferredContact,
      company_name: state.companyName,
      website: state.website,
      vehicle_category: state.vehicleCategory,
      vehicle_year: state.vehicleYear,
      vehicle_make: state.vehicleMake,
      vehicle_model: state.vehicleModel,
      vehicle_count: state.vehicleCount,
      project_type: state.projectType,
      design_scenario: state.designScenario,
      price_range_min: state.priceMin,
      price_range_max: state.priceMax,
      design_fee_min: state.designFeeMin,
      design_fee_max: state.designFeeMax,
      vision_description: state.visionDescription,
      timeline: state.timeline,
      budget_range: state.budgetRange
    };
    FWG_ATTR_FORM.attach(data);

    try {
  const response = await fetch(`${CONFIG.apiUrl}/api/estimator/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  const result = await response.json();
      
      if (result.ok) {
        showSuccess(result.submission_id);
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (error) {
      console.error('Submission error:', error);
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Get My Free Quote →';
      alert('There was an error submitting your request. Please try again or call us directly.');
    }
  }
  
  function showSuccess(submissionId) {
    const container = document.querySelector('.fwg-estimator');
    container.innerHTML = `
      <div class="fwg-success">
        <div class="fwg-success-icon">✅</div>
        <h2>Request Received!</h2>
        <p>Thank you for your interest in Frederick Window Graphics.</p>
        <p>We've received your request and will be in touch within 1 business day to discuss your project.</p>
        <div class="fwg-success-id">Reference: ${submissionId}</div>
        <div class="fwg-success-actions">
          <a href="tel:+12406933715" class="fwg-btn fwg-btn-secondary">📞 Call Us Now</a>
          <a href="/" class="fwg-btn fwg-btn-primary">← Back to Home</a>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  window.FWGEstimator = {
    init,
    nextStep,
    prevStep,
    selectVehicle,
    selectProject,
    selectScenario,
    adjustQuantity,
    updateVehicle,
    updateDetails,
    updateContact,
    submit
  };
  
  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();