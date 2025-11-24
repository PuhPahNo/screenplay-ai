// GitHub repository details
const GITHUB_USER = 'PuhPahNo';
const GITHUB_REPO = 'screenplay-ai';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases/latest`;

// Detect user's operating system
function detectOS() {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const platform = window.navigator.platform.toLowerCase();

    if (platform.includes('mac') || userAgent.includes('macintosh')) {
        return 'mac';
    } else if (platform.includes('win') || userAgent.includes('windows')) {
        return 'windows';
    } else if (platform.includes('linux') || userAgent.includes('x11')) {
        return 'linux';
    }

    return 'windows'; // Default fallback
}

// Get download URL for specific platform
function getDownloadUrl(release, platform) {
    if (!release || !release.assets) return null;

    const assets = release.assets;

    switch (platform) {
        case 'mac':
            // Prefer .dmg for Mac
            const dmg = assets.find(a => a.name.endsWith('.dmg'));
            if (dmg) return dmg.browser_download_url;

            // Fallback to universal .zip
            const macZip = assets.find(a => a.name.includes('mac') && a.name.endsWith('.zip'));
            if (macZip) return macZip.browser_download_url;
            break;

        case 'windows':
            // Prefer .exe installer
            const exe = assets.find(a => a.name.endsWith('.exe') && !a.name.includes('portable'));
            if (exe) return exe.browser_download_url;
            break;

        case 'linux':
            // Prefer AppImage
            const appImage = assets.find(a => a.name.endsWith('.AppImage'));
            if (appImage) return appImage.browser_download_url;

            // Fallback to .deb
            const deb = assets.find(a => a.name.endsWith('.deb'));
            if (deb) return deb.browser_download_url;
            break;
    }

    return null;
}

// Fetch latest release from GitHub
async function fetchLatestRelease() {
    try {
        const response = await fetch(GITHUB_API);
        if (!response.ok) {
            throw new Error('Failed to fetch release info');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching release:', error);
        return null;
    }
}

// Update download buttons with release info
async function updateDownloadButtons() {
    const release = await fetchLatestRelease();

    if (!release) {
        console.error('No release data available');
        showFallbackDownloads();
        return;
    }

    // Update version info
    const versionElement = document.getElementById('current-version');
    if (versionElement) {
        versionElement.textContent = release.tag_name || 'Unknown';
    }

    // Get user's OS
    const userOS = detectOS();

    // Setup download buttons
    const macBtn = document.getElementById('download-mac');
    const windowsBtn = document.getElementById('download-windows');
    const linuxBtn = document.getElementById('download-linux');

    const macUrl = getDownloadUrl(release, 'mac');
    const windowsUrl = getDownloadUrl(release, 'windows');
    const linuxUrl = getDownloadUrl(release, 'linux');

    // Set URLs
    if (macUrl && macBtn) {
        macBtn.href = macUrl;
    }
    if (windowsUrl && windowsBtn) {
        windowsBtn.href = windowsUrl;
    }
    if (linuxUrl && linuxBtn) {
        linuxBtn.href = linuxUrl;
    }

    // Show the user's platform button prominently
    if (userOS === 'mac' && macBtn) {
        macBtn.style.display = 'flex';
    } else if (userOS === 'windows' && windowsBtn) {
        windowsBtn.style.display = 'flex';
    } else if (userOS === 'linux' && linuxBtn) {
        linuxBtn.style.display = 'flex';
    }

    // Setup "other platforms" links
    setupPlatformLinks(release);
}

// Setup links for other platforms
function setupPlatformLinks(release) {
    const platformLinks = document.querySelectorAll('.platform-link');

    platformLinks.forEach(link => {
        const platform = link.dataset.platform;
        const url = getDownloadUrl(release, platform);

        if (url) {
            link.href = url;
        } else {
            link.style.display = 'none';
        }
    });
}

// Fallback if GitHub API fails
function showFallbackDownloads() {
    const userOS = detectOS();

    if (userOS === 'mac') {
        document.getElementById('download-mac').style.display = 'flex';
    } else if (userOS === 'windows') {
        document.getElementById('download-windows').style.display = 'flex';
    } else if (userOS === 'linux') {
        document.getElementById('download-linux').style.display = 'flex';
    }

    // Point to GitHub releases page
    const releasePageUrl = `https://github.com/${GITHUB_USER}/${GITHUB_REPO}/releases/latest`;

    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.href = releasePageUrl;
    });

    document.querySelectorAll('.platform-link').forEach(link => {
        link.href = releasePageUrl;
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');

        // Skip if it's just "#" or if it's a download button
        if (href === '#' || this.classList.contains('download-btn')) {
            return;
        }

        e.preventDefault();
        const target = document.querySelector(href);

        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateDownloadButtons();
    initParticles();
});

// Particle Animation System
function initParticles() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = document.documentElement.scrollHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', () => {
        resizeCanvas();
        // Reinitialize particles on resize
        initializeParticles();
    });
    
    // Particle class
    class Particle {
        constructor() {
            this.reset();
            // Start particles at random positions
            this.y = Math.random() * canvas.height;
        }
        
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random() * 0.3 + 0.1;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            // Wrap around edges
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;
        }
        
        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Create particles
    const particles = [];
    const particleCount = 60;
    
    function initializeParticles() {
        particles.length = 0;
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }
    
    initializeParticles();
    
    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

