// AutoPush Web Application Logic
// Handles live countdown, GitHub REST API integrations, cloud workflow installation, and commit feeds.

const STORAGE_KEY = 'autopush_engine_v1';

// Default App State
const state = {
  ghOwner: '',
  ghRepo: '',
  ghBranch: 'main',
  ghToken: '',
  ghTargetFile: 'letters_log.txt',
  randomMode: 'uppercase',
  timezoneMode: 'local', // 'local' or 'utc'
  nextQueuedLetter: 'A',
  isSpinning: false,
};

// Word list for 'word' random mode
const RANDOM_WORDS = [
  'Alpha', 'Brave', 'Cyber', 'Delta', 'Echo', 'Falcon', 'Galaxy',
  'Horizon', 'Infinity', 'Jupiter', 'Krypton', 'Lunar', 'Matrix',
  'Nebula', 'Orion', 'Pulse', 'Quantum', 'Radiant', 'Stellar',
  'Titan', 'Ultra', 'Vortex', 'Wave', 'Xenon', 'Yield', 'Zenith'
];

const EMOJIS = ['✨', '🚀', '⚡', '🌌', '🔥', '💫', '💎', '🛸', '🔮', '🌟', '🎯', '🛰️'];

// DOM Elements
const elements = {
  // Countdown
  countdownHours: document.getElementById('countdownHours'),
  countdownMinutes: document.getElementById('countdownMinutes'),
  countdownSeconds: document.getElementById('countdownSeconds'),
  countdownProgressFill: document.getElementById('countdownProgressFill'),
  cycleStartLabel: document.getElementById('cycleStartLabel'),
  cyclePercentage: document.getElementById('cyclePercentage'),
  cycleTargetLabel: document.getElementById('cycleTargetLabel'),
  nextTriggerTimeBadge: document.getElementById('nextTriggerTimeBadge'),
  tzLocalBtn: document.getElementById('tzLocalBtn'),
  tzUtcBtn: document.getElementById('tzUtcBtn'),
  previewChar: document.getElementById('previewChar'),
  rerollLetterBtn: document.getElementById('rerollLetterBtn'),

  // Header Status
  connectionStatusIndicator: document.getElementById('connectionStatusIndicator'),
  connectionStatusText: document.getElementById('connectionStatusText'),

  // Stats
  cloudEngineStatus: document.getElementById('cloudEngineStatus'),
  totalPushesCounter: document.getElementById('totalPushesCounter'),
  totalPushesDesc: document.getElementById('totalPushesDesc'),
  lastPushedLetter: document.getElementById('lastPushedLetter'),
  lastPushedTime: document.getElementById('lastPushedTime'),

  // Form Fields
  ghOwner: document.getElementById('ghOwner'),
  ghRepo: document.getElementById('ghRepo'),
  ghBranch: document.getElementById('ghBranch'),
  ghTargetFile: document.getElementById('ghTargetFile'),
  ghToken: document.getElementById('ghToken'),
  toggleTokenVisibility: document.getElementById('toggleTokenVisibility'),
  randomModeSelect: document.getElementById('randomModeSelect'),
  installWorkflowBtn: document.getElementById('installWorkflowBtn'),
  testPushNowBtn: document.getElementById('testPushNowBtn'),
  workflowStatusDetails: document.getElementById('workflowStatusDetails'),
  workflowStatusCard: document.getElementById('workflowStatusCard'),

  // Commits Feed
  commitsContainer: document.getElementById('commitsContainer'),
  emptyStatePlaceholder: document.getElementById('emptyStatePlaceholder'),
  refreshCommitsBtn: document.getElementById('refreshCommitsBtn'),

  // Guide Modal & Toasts
  guideBtn: document.getElementById('guideBtn'),
  guideModal: document.getElementById('guideModal'),
  closeGuideModal: document.getElementById('closeGuideModal'),
  toastContainer: document.getElementById('toastContainer'),
};

// ==========================================
// Initialization
// ==========================================
function initApp() {
  loadConfig();
  generateNextLetter();
  setupEventListeners();
  updateCountdown();
  setInterval(updateCountdown, 1000);

  if (state.ghOwner && state.ghRepo && state.ghToken) {
    verifyAndSyncRepo();
  } else {
    setConnectionStatus('unconfigured', 'Awaiting Configuration');
  }
}

// ==========================================
// Local Storage Configuration
// ==========================================
function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(state, saved);

      elements.ghOwner.value = state.ghOwner || '';
      elements.ghRepo.value = state.ghRepo || '';
      elements.ghBranch.value = state.ghBranch || 'main';
      elements.ghTargetFile.value = state.ghTargetFile || 'letters_log.txt';
      elements.ghToken.value = state.ghToken || '';
      elements.randomModeSelect.value = state.randomMode || 'uppercase';

      if (state.timezoneMode === 'utc') {
        elements.tzUtcBtn.classList.add('active');
        elements.tzLocalBtn.classList.remove('active');
      } else {
        elements.tzLocalBtn.classList.add('active');
        elements.tzUtcBtn.classList.remove('active');
      }
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

function saveConfig() {
  state.ghOwner = elements.ghOwner.value.trim();
  state.ghRepo = elements.ghRepo.value.trim();
  state.ghBranch = elements.ghBranch.value.trim() || 'main';
  state.ghTargetFile = elements.ghTargetFile.value.trim() || 'letters_log.txt';
  state.ghToken = elements.ghToken.value.trim();
  state.randomMode = elements.randomModeSelect.value;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
  // Input fields auto-save on change
  [elements.ghOwner, elements.ghRepo, elements.ghBranch, elements.ghTargetFile, elements.ghToken].forEach(input => {
    input.addEventListener('input', () => {
      saveConfig();
      if (elements.ghOwner.value && elements.ghRepo.value && elements.ghToken.value) {
        setConnectionStatus('pending', 'Configuration Ready');
      }
    });
  });

  elements.randomModeSelect.addEventListener('change', () => {
    saveConfig();
    generateNextLetter();
  });

  // Timezone switcher
  elements.tzLocalBtn.addEventListener('click', () => {
    state.timezoneMode = 'local';
    elements.tzLocalBtn.classList.add('active');
    elements.tzUtcBtn.classList.remove('active');
    saveConfig();
    updateCountdown();
  });

  elements.tzUtcBtn.addEventListener('click', () => {
    state.timezoneMode = 'utc';
    elements.tzUtcBtn.classList.add('active');
    elements.tzLocalBtn.classList.remove('active');
    saveConfig();
    updateCountdown();
  });

  // Shuffle preview letter
  elements.rerollLetterBtn.addEventListener('click', () => {
    generateNextLetter(true);
  });

  // Toggle token password visibility
  elements.toggleTokenVisibility.addEventListener('click', () => {
    const isPass = elements.ghToken.type === 'password';
    elements.ghToken.type = isPass ? 'text' : 'password';
  });

  // Action Buttons
  elements.installWorkflowBtn.addEventListener('click', installCloudWorkflow);
  elements.testPushNowBtn.addEventListener('click', triggerInstantPush);
  elements.refreshCommitsBtn.addEventListener('click', () => {
    fetchLatestCommits(true);
  });

  // Guide Modal
  elements.guideBtn.addEventListener('click', () => {
    elements.guideModal.classList.add('open');
  });
  elements.closeGuideModal.addEventListener('click', () => {
    elements.guideModal.classList.remove('open');
  });
  elements.guideModal.addEventListener('click', (e) => {
    if (e.target === elements.guideModal) {
      elements.guideModal.classList.remove('open');
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.guideModal.classList.contains('open')) {
      elements.guideModal.classList.remove('open');
    }
  });
}

// ==========================================
// Random Letter / Content Generation
// ==========================================
function getRandomItem() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const alphaNum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  switch (state.randomMode) {
    case 'lowercase':
      return letters[Math.floor(Math.random() * letters.length)].toLowerCase();
    case 'alphanumeric':
      return alphaNum[Math.floor(Math.random() * alphaNum.length)];
    case 'word':
      return RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)];
    case 'emoji_letter': {
      const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const char = letters[Math.floor(Math.random() * letters.length)];
      return `${emoji} ${char}`;
    }
    case 'uppercase':
    default:
      return letters[Math.floor(Math.random() * letters.length)];
  }
}

function generateNextLetter(animate = false) {
  if (animate) {
    elements.previewChar.style.transform = 'scale(0.8)';
    setTimeout(() => {
      state.nextQueuedLetter = getRandomItem();
      elements.previewChar.textContent = state.nextQueuedLetter;
      elements.previewChar.style.transform = 'scale(1)';
    }, 150);
  } else {
    state.nextQueuedLetter = getRandomItem();
    elements.previewChar.textContent = state.nextQueuedLetter;
  }
}

// ==========================================
// Countdown & Timing Engine (12 AM & 12 PM)
// ==========================================
function updateCountdown() {
  const now = new Date();
  let prevTrigger, nextTrigger;

  if (state.timezoneMode === 'utc') {
    // Current UTC time
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const date = now.getUTCDate();
    const hours = now.getUTCHours();

    if (hours < 12) {
      // Current cycle: 00:00 UTC (12:00 AM) -> 12:00 UTC (12:00 PM)
      prevTrigger = new Date(Date.UTC(year, month, date, 0, 0, 0));
      nextTrigger = new Date(Date.UTC(year, month, date, 12, 0, 0));
      elements.cycleStartLabel.textContent = 'Cycle: 12:00 AM UTC';
      elements.cycleTargetLabel.textContent = 'Target: 12:00 PM UTC';
      elements.nextTriggerTimeBadge.textContent = '12:00:00 PM UTC';
    } else {
      // Current cycle: 12:00 UTC (12:00 PM) -> 00:00 UTC next day (12:00 AM)
      prevTrigger = new Date(Date.UTC(year, month, date, 12, 0, 0));
      nextTrigger = new Date(Date.UTC(year, month, date + 1, 0, 0, 0));
      elements.cycleStartLabel.textContent = 'Cycle: 12:00 PM UTC';
      elements.cycleTargetLabel.textContent = 'Target: 12:00 AM UTC';
      elements.nextTriggerTimeBadge.textContent = '12:00:00 AM UTC';
    }
  } else {
    // Local Time
    const hours = now.getHours();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();

    if (hours < 12) {
      prevTrigger = new Date(year, month, date, 0, 0, 0);
      nextTrigger = new Date(year, month, date, 12, 0, 0);
      elements.cycleStartLabel.textContent = 'Cycle: 12:00 AM Local';
      elements.cycleTargetLabel.textContent = 'Target: 12:00 PM Local';
      elements.nextTriggerTimeBadge.textContent = '12:00:00 PM Local';
    } else {
      prevTrigger = new Date(year, month, date, 12, 0, 0);
      nextTrigger = new Date(year, month, date + 1, 0, 0, 0);
      elements.cycleStartLabel.textContent = 'Cycle: 12:00 PM Local';
      elements.cycleTargetLabel.textContent = 'Target: 12:00 AM Local';
      elements.nextTriggerTimeBadge.textContent = '12:00:00 AM Local';
    }
  }

  const totalCycleMs = nextTrigger.getTime() - prevTrigger.getTime();
  const elapsedMs = Math.max(0, now.getTime() - prevTrigger.getTime());
  const remainingMs = Math.max(0, nextTrigger.getTime() - now.getTime());

  // Compute percentage
  const pct = Math.min(100, Math.max(0, (elapsedMs / totalCycleMs) * 100));
  elements.countdownProgressFill.style.width = `${pct.toFixed(2)}%`;
  elements.cyclePercentage.textContent = `${pct.toFixed(1)}% Completed`;

  // Format Hours : Minutes : Seconds
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  elements.countdownHours.textContent = String(hrs).padStart(2, '0');
  elements.countdownMinutes.textContent = String(mins).padStart(2, '0');
  elements.countdownSeconds.textContent = String(secs).padStart(2, '0');

  // Trigger pulse effect when rollover happens
  if (remainingMs <= 1000 && !state.isSpinning) {
    triggerRolloverRefresh();
  }
}

function triggerRolloverRefresh() {
  state.isSpinning = true;
  generateNextLetter(true);
  showToast('12:00 Trigger Reached! Refreshing commits...', 'success');
  setTimeout(() => {
    fetchLatestCommits(false);
    state.isSpinning = false;
  }, 5000);
}

// ==========================================
// Status & Notifications Helpers
// ==========================================
function setConnectionStatus(type, label) {
  const dot = elements.connectionStatusIndicator.querySelector('.status-dot');
  elements.connectionStatusText.textContent = label;

  dot.className = 'status-dot';
  if (type === 'active') {
    dot.classList.add('active');
  } else if (type === 'pending') {
    dot.classList.add('pending');
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✔' : type === 'error' ? '✖' : 'ℹ';
  toast.innerHTML = `<strong>${icon}</strong><span>${message}</span>`;

  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================
// GitHub REST API Integration
// ==========================================

// Helper for authenticated GitHub API calls
async function githubRequest(path, options = {}) {
  const token = state.ghToken || elements.ghToken.value.trim();
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers
  });

  return response;
}

// 1. Verify Repository Connection & Fetch Info
async function verifyAndSyncRepo() {
  saveConfig();
  if (!state.ghOwner || !state.ghRepo || !state.ghToken) {
    showToast('Please enter your GitHub Username, Repo, and Token', 'error');
    return;
  }

  setConnectionStatus('pending', 'Connecting to GitHub...');

  try {
    const res = await githubRequest(`/repos/${state.ghOwner}/${state.ghRepo}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Repository not found. Check owner/repo name and token permissions.');
      } else if (res.status === 401) {
        throw new Error('Invalid GitHub token. Please check token permissions.');
      } else {
        throw new Error(`GitHub API error: ${res.statusText}`);
      }
    }

    const repoData = await res.json();
    setConnectionStatus('active', `Connected: ${repoData.full_name}`);
    showToast(`Connected to ${repoData.name}!`, 'success');

    // Check if cloud workflow is installed
    checkCloudWorkflowStatus();

    // Fetch commit feed
    fetchLatestCommits();
  } catch (err) {
    console.error('Repo verification failed:', err);
    setConnectionStatus('error', 'Connection Failed');
    showToast(err.message, 'error');
  }
}

// 2. Check if GitHub Actions Workflow exists
async function checkCloudWorkflowStatus() {
  try {
    const res = await githubRequest(`/repos/${state.ghOwner}/${state.ghRepo}/contents/.github/workflows/auto-push.yml`);
    if (res.ok) {
      elements.cloudEngineStatus.textContent = 'Active (24/7)';
      elements.cloudEngineStatus.style.color = 'var(--accent-green)';
      elements.workflowStatusDetails.innerHTML = `
        <span style="color: var(--accent-green); font-weight: bold;">✔ Active 24/7 Cloud Automation Detected!</span><br>
        Workflow file <code>.github/workflows/auto-push.yml</code> is scheduled on GitHub at <strong>12:00 AM and 12:00 PM</strong> daily.
      `;
    } else {
      elements.cloudEngineStatus.textContent = 'Not Installed';
      elements.cloudEngineStatus.style.color = 'var(--accent-amber)';
      elements.workflowStatusDetails.innerHTML = `
        Workflow file not yet installed. Click <strong>"Install 24/7 Cloud Automation"</strong> to enable automated daily scheduled commits.
      `;
    }
  } catch (err) {
    console.warn('Could not verify workflow status:', err);
  }
}

// 3. 1-Click Install of 24/7 Cloud Workflow
async function installCloudWorkflow() {
  saveConfig();
  if (!state.ghOwner || !state.ghRepo || !state.ghToken) {
    showToast('Please provide your GitHub username, repo name, and token first!', 'error');
    return;
  }

  const btn = elements.installWorkflowBtn;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `
    <svg class="spinning" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
    </svg>
    <span>Deploying to GitHub...</span>
  `;

  try {
    // Fetch existing file SHA if already exists
    let existingSha = null;
    const checkRes = await githubRequest(`/repos/${state.ghOwner}/${state.ghRepo}/contents/.github/workflows/auto-push.yml`);
    if (checkRes.ok) {
      const data = await checkRes.json();
      existingSha = data.sha;
    }

    // Dynamic workflow template
    const workflowContent = `name: Auto Push Daily Letter

on:
  schedule:
    # Executes automatically at 00:00 (12:00 AM) and 12:00 (12:00 PM) UTC daily
    - cron: '0 0,12 * * *'
  workflow_dispatch:

jobs:
  push-daily-letter:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate Random Content
        id: content-gen
        run: |
          LETTERS="ABCDEFGHIJKLMNOPQRSTUVWXYZ"
          RANDOM_INDEX=$(( RANDOM % \${#LETTERS} ))
          CHOSEN_CHAR="\${LETTERS:\$RANDOM_INDEX:1}"
          TIMESTAMP=\$(date -u +"%Y-%m-%d %H:%M:%S UTC")
          
          echo "letter=\$CHOSEN_CHAR" >> \$GITHUB_OUTPUT
          echo "timestamp=\$TIMESTAMP" >> \$GITHUB_OUTPUT

          TARGET="${state.ghTargetFile}"
          if [ ! -f "\$TARGET" ]; then
            echo "# AutoPush Daily Stream" > "\$TARGET"
            echo "Automated commits twice daily at 12:00 AM & 12:00 PM." >> "\$TARGET"
            echo "----------------------------------------------------" >> "\$TARGET"
          fi

          echo "[\$TIMESTAMP] Letter: \$CHOSEN_CHAR" >> "\$TARGET"

      - name: Commit & Push to Repo
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git add "${state.ghTargetFile}"
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "Auto push letter '\${{ steps.content-gen.outputs.letter }}' [\${{ steps.content-gen.outputs.timestamp }}]"
            git push
          fi
`;

    // Base64 encode
    const base64Content = btoa(unescape(encodeURIComponent(workflowContent)));

    // Commit file via GitHub API
    const putRes = await githubRequest(`/repos/${state.ghOwner}/${state.ghRepo}/contents/.github/workflows/auto-push.yml`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Setup 24/7 Auto Push GitHub Actions workflow (12:00 AM & 12:00 PM)',
        content: base64Content,
        branch: state.ghBranch,
        ...(existingSha ? { sha: existingSha } : {})
      })
    });

    if (!putRes.ok) {
      const errJson = await putRes.json();
      throw new Error(errJson.message || 'Failed to install workflow file');
    }

    showToast('24/7 Cloud Automation Installed Successfully!', 'success');
    elements.cloudEngineStatus.textContent = 'Active (24/7)';
    elements.cloudEngineStatus.style.color = 'var(--accent-green)';
    elements.workflowStatusDetails.innerHTML = `
      <span style="color: var(--accent-green); font-weight: bold;">✔ Active 24/7 Cloud Automation Installed!</span><br>
      GitHub Actions will run on GitHub's servers automatically at <strong>12:00 AM and 12:00 PM</strong> daily. No manual work needed!
    `;
    setConnectionStatus('active', `Connected: ${state.ghOwner}/${state.ghRepo}`);
    fetchLatestCommits();
  } catch (err) {
    console.error('Workflow install failed:', err);
    showToast(`Install failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// 4. Instant Test Push (Executes immediate commit to test connection)
async function triggerInstantPush() {
  saveConfig();
  if (!state.ghOwner || !state.ghRepo || !state.ghToken) {
    showToast('Please configure your GitHub credentials first!', 'error');
    return;
  }

  const btn = elements.testPushNowBtn;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `
    <svg class="spinning" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
    </svg>
    <span>Pushing Letter...</span>
  `;

  try {
    const pushedChar = state.nextQueuedLetter || getRandomItem();
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

    // 1. Fetch current content of target file (to get SHA and append)
    let existingSha = null;
    let currentContent = '';
    const fileRes = await githubRequest(`/repos/${state.ghOwner}/${state.ghRepo}/contents/${state.ghTargetFile}?ref=${state.ghBranch}`);

    if (fileRes.ok) {
      const fileData = await fileRes.json();
      existingSha = fileData.sha;
      currentContent = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
    } else {
      currentContent = `# AutoPush Daily Letters Stream\nCreated by AutoPush Firebase Web App\n----------------------------------------------------\n`;
    }

    // 2. Append new letter
    const updatedContent = currentContent + `[${nowIso}] Pushed Letter: ${pushedChar}\n`;
    const base64Updated = btoa(unescape(encodeURIComponent(updatedContent)));

    // 3. Commit back to GitHub
    const commitMessage = `Auto push letter '${pushedChar}' [${nowIso}]`;
    const putRes = await githubRequest(`/repos/${state.ghOwner}/${state.ghRepo}/contents/${state.ghTargetFile}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: commitMessage,
        content: base64Updated,
        branch: state.ghBranch,
        ...(existingSha ? { sha: existingSha } : {})
      })
    });

    if (!putRes.ok) {
      const errData = await putRes.json();
      throw new Error(errData.message || 'Failed to commit letter to repository');
    }

    showToast(`Pushed letter '${pushedChar}' to ${state.ghRepo}!`, 'success');
    generateNextLetter(true);

    // Refresh commits feed
    await fetchLatestCommits();
  } catch (err) {
    console.error('Instant push error:', err);
    showToast(`Push failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// 5. Fetch & Render Commit Feed
async function fetchLatestCommits(isManual = false) {
  if (!state.ghOwner || !state.ghRepo) return;

  if (isManual) {
    elements.refreshCommitsBtn.classList.add('spinning');
  }

  try {
    const res = await githubRequest(`/repos/${state.ghOwner}/${state.ghRepo}/commits?per_page=20&sha=${state.ghBranch}`);
    if (!res.ok) {
      if (res.status === 404) return;
      throw new Error(`Failed to fetch commits: ${res.statusText}`);
    }

    const commits = await res.json();
    renderCommits(commits);

    if (isManual) {
      showToast('Commit feed synced!', 'success');
    }
  } catch (err) {
    console.error('Fetch commits error:', err);
    if (isManual) showToast(err.message, 'error');
  } finally {
    if (isManual) {
      setTimeout(() => elements.refreshCommitsBtn.classList.remove('spinning'), 500);
    }
  }
}

function renderCommits(commits) {
  if (!commits || commits.length === 0) {
    elements.commitsContainer.innerHTML = '';
    elements.commitsContainer.appendChild(elements.emptyStatePlaceholder);
    elements.totalPushesCounter.textContent = '0';
    return;
  }

  elements.commitsContainer.innerHTML = '';
  elements.totalPushesCounter.textContent = commits.length.toString();
  elements.totalPushesDesc.textContent = `Latest ${commits.length} synced`;

  // Update Last Pushed Stat
  const latest = commits[0];
  const latestLetter = extractLetterFromMessage(latest.commit.message);
  elements.lastPushedLetter.textContent = latestLetter;
  elements.lastPushedTime.textContent = formatRelativeTime(new Date(latest.commit.author.date));

  commits.forEach(item => {
    const message = item.commit.message.split('\n')[0];
    const letter = extractLetterFromMessage(message);
    const shaShort = item.sha.substring(0, 7);
    const authorName = item.commit.author.name;
    const dateFormatted = formatRelativeTime(new Date(item.commit.author.date));
    const commitUrl = item.html_url;

    const el = document.createElement('div');
    el.className = 'commit-item';
    el.innerHTML = `
      <div class="letter-badge-large">${letter}</div>
      <div class="commit-details">
        <span class="commit-msg" title="${escapeHtml(message)}">${escapeHtml(message)}</span>
        <div class="commit-sub">
          <a href="${commitUrl}" target="_blank" rel="noopener" class="commit-sha">#${shaShort}</a>
          <span>&bull;</span>
          <span>${escapeHtml(authorName)}</span>
          <span>&bull;</span>
          <span>${dateFormatted}</span>
        </div>
      </div>
    `;

    elements.commitsContainer.appendChild(el);
  });
}

// Helpers
function extractLetterFromMessage(msg) {
  // Looks for quotes like 'X' or "X" or takes the first letter
  const match = msg.match(/['"]([^'"]+)['"]/);
  if (match && match[1]) {
    return match[1].substring(0, 3);
  }
  const words = msg.split(' ');
  for (let w of words) {
    if (w.length === 1 && /[a-zA-Z0-9]/.test(w)) return w.toUpperCase();
  }
  return msg.charAt(0).toUpperCase() || 'P';
}

function formatRelativeTime(date) {
  const diffMs = new Date().getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Boot up app
document.addEventListener('DOMContentLoaded', initApp);
