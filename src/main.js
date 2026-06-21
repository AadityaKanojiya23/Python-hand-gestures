import './style.css';

const Camera = window.Camera;
const Hands = window.Hands;
const HAND_CONNECTIONS = window.HAND_CONNECTIONS;
const drawConnectors = window.drawConnectors;
const drawLandmarks = window.drawLandmarks;

// --- Data Structure ---
const products = [
  {
    theme: 'theme-peach',
    bgText: 'Bauhaus',
    title: 'Small Glass<br>Pendant Light',
    image: '/lamp_peach.png',
    baseColor: '<option>Green</option><option>Yellow</option>',
    secondColor: '<option>Yellow</option><option>Green</option>',
    cordType: '<option>Hardwired</option><option>Plug-in</option>'
  },
  {
    theme: 'theme-white',
    bgText: 'Annular',
    title: 'Classic cone<br>pendant ring light',
    image: '/lamp_white.png',
    baseColor: '<option>Gray</option><option>White</option>',
    secondColor: '<option>White</option><option>Gray</option>',
    cordType: '<option>Hardwired</option><option>Plug-in</option>'
  },
  {
    theme: 'theme-green',
    bgText: 'Bauhaus',
    title: 'Small Glass<br>Pendant Light',
    image: '/lamp_green.png',
    baseColor: '<option>Mat Green</option><option>Yellow</option>',
    secondColor: '<option>Yellow</option><option>Green</option>',
    cordType: '<option>Hardwired</option><option>Plug-in</option>'
  }
];

let currentIndex = 0;

// --- UI Elements ---
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusIndicator = document.getElementById('status-indicator');
const virtualCursor = document.getElementById('virtual-cursor');

const appContainer = document.getElementById('app');
const bgTextElement = document.getElementById('bg-text');
const productTitle = document.getElementById('product-title');
const productImg = document.getElementById('product-img');
const baseColorSelect = document.getElementById('base-color');
const secondColorSelect = document.getElementById('second-color');
const cordTypeSelect = document.getElementById('cord-type');

const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

// --- Carousel Logic ---
function updateCarousel(index) {
  const p = products[index];
  
  // Transition effects
  productImg.style.opacity = 0;
  productImg.style.transform = 'scale(0.95)';
  bgTextElement.style.opacity = 0;
  
  setTimeout(() => {
    appContainer.className = p.theme;
    bgTextElement.textContent = p.bgText;
    productTitle.innerHTML = p.title;
    productImg.src = p.image;
    baseColorSelect.innerHTML = p.baseColor;
    secondColorSelect.innerHTML = p.secondColor;
    cordTypeSelect.innerHTML = p.cordType;
    
    // Rebuild custom dropdown overlays
    buildCustomDropdowns();
    
    // Fade back in
    productImg.style.opacity = 1;
    productImg.style.transform = 'scale(1)';
    bgTextElement.style.opacity = 1;
  }, 400); // Wait for fade out
}

// Build or update custom dropdowns
function buildCustomDropdowns() {
  const selects = document.querySelectorAll('.option-group select');
  
  selects.forEach(select => {
    // Hide native select
    select.style.display = 'none';
    
    // Find or create wrapper/custom container
    let customSelect = select.parentElement.querySelector('.custom-select');
    if (!customSelect) {
      customSelect = document.createElement('div');
      customSelect.className = 'custom-select';
      select.after(customSelect);
    }
    
    // Clear custom select contents
    customSelect.innerHTML = '';
    
    // Create trigger
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    const triggerSpan = document.createElement('span');
    triggerSpan.textContent = select.options[select.selectedIndex]?.text || '';
    trigger.appendChild(triggerSpan);
    customSelect.appendChild(trigger);
    
    // Create options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options';
    
    // Populate options
    Array.from(select.options).forEach((opt, idx) => {
      const customOpt = document.createElement('div');
      customOpt.className = 'custom-option';
      if (idx === select.selectedIndex) {
        customOpt.classList.add('selected');
      }
      customOpt.textContent = opt.text;
      customOpt.setAttribute('data-value', opt.value);
      
      // Click handler
      customOpt.addEventListener('click', (e) => {
        e.stopPropagation();
        select.selectedIndex = idx;
        select.dispatchEvent(new Event('change'));
        
        // Update trigger text
        triggerSpan.textContent = opt.text;
        
        // Highlight selected
        optionsContainer.querySelectorAll('.custom-option').forEach(co => co.classList.remove('selected'));
        customOpt.classList.add('selected');
        
        // Close dropdown
        customSelect.classList.remove('open');
      });
      
      optionsContainer.appendChild(customOpt);
    });
    
    customSelect.appendChild(optionsContainer);
    
    // Toggle dropdown open
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other custom dropdowns first
      document.querySelectorAll('.custom-select').forEach(cs => {
        if (cs !== customSelect) cs.classList.remove('open');
      });
      customSelect.classList.toggle('open');
    });
  });
}

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select').forEach(cs => cs.classList.remove('open'));
});

prevBtn.addEventListener('click', () => {
  currentIndex = (currentIndex - 1 + products.length) % products.length;
  updateCarousel(currentIndex);
});

nextBtn.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % products.length;
  updateCarousel(currentIndex);
});

// --- Hand Tracking State ---
let isTracking = false;
let screenW = window.innerWidth;
let screenH = window.innerHeight;

window.addEventListener('resize', () => {
  screenW = window.innerWidth;
  screenH = window.innerHeight;
});

const SMOOTHING_FACTOR = 0.65;
let cursorX = screenW / 2;
let cursorY = screenH / 2;
let targetX = cursorX;
let targetY = cursorY;

let isPinching = false;
let swipeStartX = 0;
let swipeCooldown = 0;
const PINCH_THRESHOLD = 0.04;
const SWIPE_THRESHOLD = 0.15;

function distance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function mapToScreen(x, y) {
  const mirroredX = 1 - x;
  const scale = 0.6;
  const offsetX = (1 - scale) / 2;
  const offsetY = (1 - scale) / 2;
  
  let mapX = ((mirroredX - offsetX) / scale) * screenW;
  let mapY = ((y - offsetY) / scale) * screenH;
  
  return { 
    x: Math.max(0, Math.min(screenW, mapX)), 
    y: Math.max(0, Math.min(screenH, mapY)) 
  };
}

// --- Gesture Detection ---
function processGestures(landmarks) {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];
  const palmBase = landmarks[9];

  // 1. Cursor movement
  const pos = mapToScreen(palmBase.x, palmBase.y);
  targetX = pos.x;
  targetY = pos.y;

  // 2. Pinch Detection (Click)
  const pinchDist = distance(thumbTip, indexTip);
  const currentlyPinching = pinchDist < PINCH_THRESHOLD;

  if (currentlyPinching && !isPinching) {
    isPinching = true;
    virtualCursor.classList.add('clicking');
    simulateMouseDown();
  } else if (!currentlyPinching && isPinching) {
    isPinching = false;
    virtualCursor.classList.remove('clicking');
    simulateMouseUp();
    simulateClick(); 
  }

  // 3. Swipe Detection (Carousel Navigation)
  const isIndexOpen = distance(indexTip, wrist) > 0.4;
  if (isIndexOpen && !isPinching) {
    if (swipeCooldown > 0) swipeCooldown--;
    
    if (swipeCooldown === 0) {
      if (swipeStartX === 0) {
        swipeStartX = palmBase.x;
      } else {
        const deltaX = palmBase.x - swipeStartX;
        if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
          if (deltaX > 0) {
            // Swipe Left (Mirrored) -> Next Product
            nextBtn.click();
            simulateBtnVisual(nextBtn);
          } else {
            // Swipe Right -> Prev Product
            prevBtn.click();
            simulateBtnVisual(prevBtn);
          }
          swipeCooldown = 30; // Debounce
          swipeStartX = 0;
        }
      }
    }
  } else {
    swipeStartX = 0;
  }
}

// --- Synthetic Events ---
function getElementUnderCursor() {
  return document.elementFromPoint(cursorX, cursorY);
}

function simulateClick() {
  const el = getElementUnderCursor();
  if (el) {
    el.click();
    simulateBtnVisual(el);
    
    // Check if it's a select element to open dropdown (simulated via focus)
    if (el.tagName === 'SELECT') {
      el.focus();
    }
  }
}

function simulateBtnVisual(el) {
  if (el.classList.contains('nav-btn') || el.classList.contains('btn-purchase') || el.classList.contains('nav-item')) {
    el.classList.add('synthetic-active');
    setTimeout(() => el.classList.remove('synthetic-active'), 150);
  }
}

function simulateMouseDown() {
  const el = getElementUnderCursor();
  if (el) {
    el.dispatchEvent(new MouseEvent('mousedown', { clientX: cursorX, clientY: cursorY, bubbles: true }));
  }
}

function simulateMouseUp() {
  const el = getElementUnderCursor();
  if (el) {
    el.dispatchEvent(new MouseEvent('mouseup', { clientX: cursorX, clientY: cursorY, bubbles: true }));
  }
}

let lastHoveredEl = null;

function updateCursor() {
  if (isTracking) {
    cursorX += (targetX - cursorX) * SMOOTHING_FACTOR;
    cursorY += (targetY - cursorY) * SMOOTHING_FACTOR;
    virtualCursor.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;

    // Visual hover logic
    const el = getElementUnderCursor();
    if (el !== lastHoveredEl) {
      if (lastHoveredEl) {
        lastHoveredEl.classList.remove('virtual-hover');
      }
      if (el && (el.classList.contains('nav-btn') || el.classList.contains('nav-item') || el.classList.contains('logo') || el.classList.contains('custom-select-trigger') || el.classList.contains('custom-option') || el.tagName === 'SELECT' || el.tagName === 'BUTTON')) {
        el.classList.add('virtual-hover');
        virtualCursor.classList.add('hovering');
      } else {
        virtualCursor.classList.remove('hovering');
      }
      lastHoveredEl = el;
    }
  } else {
    if (lastHoveredEl) {
      lastHoveredEl.classList.remove('virtual-hover');
      lastHoveredEl = null;
    }
    virtualCursor.classList.remove('hovering');
  }
  requestAnimationFrame(updateCursor);
}
requestAnimationFrame(updateCursor);

// --- MediaPipe Setup ---
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    if (!isTracking) {
      isTracking = true;
      document.body.classList.add('tracking-active');
      document.querySelector('.camera-container').style.display = 'block';
    }
    
    const landmarks = results.multiHandLandmarks[0];
    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
    drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 2});
    
    processGestures(landmarks);
  } else {
    if (isTracking) {
      isTracking = false;
      document.body.classList.remove('tracking-active');
      virtualCursor.classList.remove('clicking');
      isPinching = false;
      document.querySelector('.camera-container').style.display = 'none'; // hide when no hand
    }
  }
  canvasCtx.restore();
}

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 1280,
  height: 720
});

statusIndicator.textContent = "Requesting Camera...";
camera.start().then(() => {
  statusIndicator.textContent = "Tracking Active";
  statusIndicator.classList.remove('loading');
}).catch(err => {
  statusIndicator.textContent = "Camera Error";
  console.error(err);
});

// Init layout
updateCarousel(0);
