// ==========================================
// LIQUID GLASS MUSIC PLAYER - JAVASCRIPT
// ==========================================

class VinylMusicPlayer {
  constructor() {
    // Elements
    this.library = document.getElementById('library');
    this.player = document.getElementById('player');
    this.audio = document.getElementById('audioPlayer');
    this.canvas = document.getElementById('vinylCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Audio Context for pitch control
    this.audioContext = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.analyser = null;
    this.audioInitialized = false;

    // State
    this.tracks = [];
    this.currentTrackIndex = 0;
    this.isPlaying = false;
    this.isDragging = false;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.lastAngle = 0;

    // Controls
    this.playbackRate = 1.0;
    this.pitchValue = 0;

    // Vinyl texture
    this.vinylTexture = new Image();
    this.vinylTexture.src = 'Vynil_vinil_92837841.png';
    this.vinylTextureLoaded = false;
    this.vinylTexture.onload = () => {
      this.vinylTextureLoaded = true;
      console.log('Vinyl texture loaded successfully');
    };
    this.vinylTexture.onerror = () => {
      console.error('Failed to load vinyl texture');
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeAudioContext();
    this.loadSampleTracks();

    if (this.canvas) {
      this.drawVinyl();
      this.animateVinyl();
    }
  }

  setupEventListeners() {
    // Library navigation
    document.querySelectorAll('.vinyl-card').forEach((card, index) => {
      card.addEventListener('click', () => this.openPlayer(index));
    });

    // File input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // iOS fix: Also handle click on label
    const addBtn = document.querySelector('.btn-add');
    if (addBtn && fileInput) {
      addBtn.addEventListener('click', (e) => {
        // Force trigger file input on iOS
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          e.preventDefault();
          fileInput.click();
        }
      });
    }

    // Mini player controls
    const miniPlayBtn = document.getElementById('miniPlayBtn');
    if (miniPlayBtn) {
      miniPlayBtn.addEventListener('click', () => this.togglePlay());
    }

    const miniPrevBtn = document.getElementById('miniPrevBtn');
    if (miniPrevBtn) {
      miniPrevBtn.addEventListener('click', () => this.previousTrack());
    }

    const miniNextBtn = document.getElementById('miniNextBtn');
    if (miniNextBtn) {
      miniNextBtn.addEventListener('click', () => this.nextTrack());
    }

    const miniOpenPlayerBtn = document.getElementById('miniOpenPlayerBtn');
    if (miniOpenPlayerBtn) {
      miniOpenPlayerBtn.addEventListener('click', () => this.openPlayer(this.currentTrackIndex));
    }

    // Player controls
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.closePlayer());
    }

    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
      playBtn.addEventListener('click', () => this.togglePlay());
    }

    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.previousTrack());
    }

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextTrack());
    }

    // Speed control
    const speedControl = document.getElementById('speedControl');
    if (speedControl) {
      speedControl.addEventListener('input', (e) => this.changeSpeed(e.target.value));
    }

    // Pitch control
    const pitchControl = document.getElementById('pitchControl');
    if (pitchControl) {
      pitchControl.addEventListener('input', (e) => this.changePitch(e.target.value));
    }

    // Reset button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetEffects());
    }

    // Audio events
    if (this.audio) {
      this.audio.addEventListener('timeupdate', () => this.updateTime());
      this.audio.addEventListener('ended', () => this.nextTrack());
      this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
    }

    // Vinyl interaction
    if (this.canvas) {
      this.canvas.addEventListener('mousedown', (e) => this.startDrag(e));
      this.canvas.addEventListener('mousemove', (e) => this.drag(e));
      this.canvas.addEventListener('mouseup', () => this.endDrag());
      this.canvas.addEventListener('mouseleave', () => this.endDrag());

      // Touch events for mobile
      this.canvas.addEventListener('touchstart', (e) => this.startDrag(e.touches[0]));
      this.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        this.drag(e.touches[0]);
      });
      this.canvas.addEventListener('touchend', () => this.endDrag());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.library.classList.contains('hidden')) {
        e.preventDefault();
        this.togglePlay();
      }
    });
  }

  initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  setupAudioNodes() {
    if (!this.audioContext || this.audioInitialized) return;

    try {
      // Create media element source
      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();

      // Create analyser (optional, for future visualizations)
      this.analyser = this.audioContext.createAnalyser();

      // Connect nodes: source -> gain -> destination
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.audioInitialized = true;
    } catch (error) {
      console.warn('Failed to setup audio nodes:', error);
    }
  }

  loadSampleTracks() {
    // Start with empty library - users will add their tracks
    this.tracks = [];
  }

  async handleFileUpload(event) {
    const files = Array.from(event.target.files);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.type.startsWith('audio/') || this.isSupportedAudioFile(file.name)) {
        const url = URL.createObjectURL(file);
        const trackName = file.name.replace(/\.[^/.]+$/, '');

        // Extract metadata
        const metadata = await this.extractMetadata(file);

        const track = {
          title: metadata.title || trackName,
          artist: metadata.artist || 'Unknown Artist',
          album: metadata.album || '',
          url: url,
          coverArt: metadata.coverArt || null,
          colors: metadata.colors || this.getDefaultColors(),
          file: file
        };

        // Always add new tracks (don't replace)
        this.tracks.push(track);
      }
    }

    // Update UI
    this.updateLibraryUI();
  }

  isSupportedAudioFile(filename) {
    const supportedFormats = [
      '.mp3', '.wav', '.flac', '.m4a', '.aac',
      '.ogg', '.opus', '.weba', '.oga', '.alac'
    ];
    return supportedFormats.some(format => filename.toLowerCase().endsWith(format));
  }

  extractMetadata(file) {
    return new Promise((resolve) => {
      if (!window.jsmediatags) {
        resolve({});
        return;
      }

      jsmediatags.read(file, {
        onSuccess: async (tag) => {
          const tags = tag.tags;
          let coverArt = null;
          let colors = null;

          // Extract cover art
          if (tags.picture) {
            const { data, format } = tags.picture;
            let base64String = '';
            for (let i = 0; i < data.length; i++) {
              base64String += String.fromCharCode(data[i]);
            }
            coverArt = `data:${format};base64,${window.btoa(base64String)}`;

            // Extract colors from cover art
            colors = await this.extractColorsFromImage(coverArt);
          }

          resolve({
            title: tags.title,
            artist: tags.artist,
            album: tags.album,
            coverArt: coverArt,
            colors: colors || this.getDefaultColors()
          });
        },
        onError: (error) => {
          console.warn('Metadata extraction failed:', error);
          resolve({});
        }
      });
    });
  }

  async extractColorsFromImage(imageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const colors = this.getDominantColors(imageData);
          resolve(colors);
        } catch (error) {
          console.warn('Color extraction failed:', error);
          resolve(this.getDefaultColors());
        }
      };

      img.onerror = () => {
        resolve(this.getDefaultColors());
      };

      img.src = imageUrl;
    });
  }

  getDominantColors(imageData) {
    const data = imageData.data;
    const colorMap = {};
    const sampleRate = 10; // Sample every 10th pixel for performance

    for (let i = 0; i < data.length; i += 4 * sampleRate) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 125) continue; // Skip transparent pixels

      // Quantize colors
      const qr = Math.round(r / 51) * 51;
      const qg = Math.round(g / 51) * 51;
      const qb = Math.round(b / 51) * 51;

      const key = `${qr},${qg},${qb}`;
      colorMap[key] = (colorMap[key] || 0) + 1;
    }

    // Sort by frequency
    const sortedColors = Object.entries(colorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (sortedColors.length === 0) {
      return this.getDefaultColors();
    }

    const [r, g, b] = sortedColors[0][0].split(',').map(Number);
    const primary = `rgb(${r}, ${g}, ${b})`;

    // Create lighter and darker variants
    const lighter = `rgb(${Math.min(r + 40, 255)}, ${Math.min(g + 40, 255)}, ${Math.min(b + 40, 255)})`;
    const darker = `rgb(${Math.max(r - 40, 0)}, ${Math.max(g - 40, 0)}, ${Math.max(b - 40, 0)})`;

    return { primary, lighter, darker };
  }

  getDefaultColors() {
    return {
      primary: 'rgb(42, 42, 42)',
      lighter: 'rgb(82, 82, 82)',
      darker: 'rgb(26, 26, 26)'
    };
  }

  updateLibraryUI() {
    const grid = document.querySelector('.library-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (this.tracks.length === 0) {
      // Show empty state
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <div class="empty-icon">🎵</div>
        <p class="empty-text">Нажмите "+ Добавить трек" чтобы начать</p>
      `;
      grid.appendChild(emptyState);
      return;
    }

    this.tracks.forEach((track, index) => {
      const card = document.createElement('div');
      card.className = 'vinyl-card glass';
      card.dataset.track = index;

      // Create canvas for vinyl
      const canvasId = `vinyl-card-canvas-${index}`;

      card.innerHTML = `
        <div class="vinyl-disc-wrapper">
          <canvas class="vinyl-card-canvas" id="${canvasId}" width="300" height="300"></canvas>
        </div>
        <div class="track-info">
          <h3 class="track-title">${track.title}</h3>
          <p class="track-artist">${track.artist}</p>
        </div>
      `;

      card.addEventListener('click', () => this.openPlayer(index));
      grid.appendChild(card);

      // Draw vinyl on card after it's added to DOM
      setTimeout(() => this.drawLibraryVinyl(canvasId, track), 0);
    });
  }

  hexToRgba(color, alpha) {
    // Convert rgb(r, g, b) to rgba(r, g, b, alpha)
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    return color;
  }

  openPlayer(index) {
    const track = this.tracks[index];

    if (!track.url) {
      alert('Пожалуйста, загрузите MP3 файл для этого трека');
      document.getElementById('fileInput').click();
      return;
    }

    this.currentTrackIndex = index;
    this.library.classList.add('hidden');
    this.player.classList.remove('hidden');

    this.loadTrack(index);
  }

  closePlayer() {
    // Don't pause - keep music playing during navigation
    this.player.classList.add('hidden');
    this.library.classList.remove('hidden');

    // Show mini player when closing full player
    this.updateMiniPlayer();
  }

  loadTrack(index) {
    const track = this.tracks[index];
    if (!track || !track.url) return;

    this.audio.src = track.url;

    // Update UI
    document.getElementById('playerTrackTitle').textContent = track.title;
    document.getElementById('playerTrackArtist').textContent = track.artist;

    // Load cover art for vinyl
    if (track.coverArt) {
      this.coverImage = new Image();
      this.coverImage.src = track.coverArt;
    } else {
      this.coverImage = null;
    }

    // Remove any glow effects (Web 1.0 style - no fancy effects)
    if (this.canvas) {
      this.canvas.style.boxShadow = '';
      this.canvas.style.filter = '';
    }

    // Reset effects
    this.resetEffects();

    // Auto-play
    this.play();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (!this.audio.src) return;

    // Setup audio nodes on first play
    if (!this.audioInitialized) {
      this.setupAudioNodes();
    }

    // Resume audio context (required for some browsers)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.audio.play();
    this.isPlaying = true;

    // Update UI
    document.getElementById('playIcon').classList.add('hidden');
    document.getElementById('pauseIcon').classList.remove('hidden');
    document.getElementById('tonearm').classList.add('playing');

    // Update mini player
    this.updateMiniPlayer();
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;

    // Update UI
    document.getElementById('playIcon').classList.remove('hidden');
    document.getElementById('pauseIcon').classList.add('hidden');
    document.getElementById('tonearm').classList.remove('playing');

    // Update mini player
    this.updateMiniPlayer();
  }

  previousTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.loadTrack(this.currentTrackIndex);
  }

  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.loadTrack(this.currentTrackIndex);
  }

  changeSpeed(value) {
    this.playbackRate = parseFloat(value);
    this.updatePlaybackRate();
    document.getElementById('speedValue').textContent = value + 'x';
  }

  changePitch(value) {
    this.pitchValue = parseInt(value);
    document.getElementById('pitchValue').textContent = value > 0 ? '+' + value : value;
    this.updatePlaybackRate();
  }

  updatePlaybackRate() {
    // Calculate pitch shift factor (semitones to frequency ratio)
    const pitchFactor = Math.pow(2, this.pitchValue / 12);

    // Combine speed and pitch
    // preservesPitch: false allows pitch to change with playback rate
    this.audio.preservesPitch = false;
    this.audio.mozPreservesPitch = false;
    this.audio.webkitPreservesPitch = false;

    // Apply combined playback rate (speed × pitch)
    this.audio.playbackRate = this.playbackRate * pitchFactor;
  }

  resetEffects() {
    // Reset speed
    this.playbackRate = 1.0;
    document.getElementById('speedControl').value = 1.0;
    document.getElementById('speedValue').textContent = '1.0x';

    // Reset pitch
    this.pitchValue = 0;
    document.getElementById('pitchControl').value = 0;
    document.getElementById('pitchValue').textContent = '0';

    // Apply reset
    this.updatePlaybackRate();
  }

  updateTime() {
    const current = this.audio.currentTime;
    const duration = this.audio.duration;

    document.getElementById('currentTime').textContent = this.formatTime(current);

    // Update rotation based on playback
    if (this.isPlaying && !this.isDragging) {
      this.rotation += this.playbackRate * 2;
    }
  }

  updateDuration() {
    const duration = this.audio.duration;
    document.getElementById('totalTime').textContent = this.formatTime(duration);
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // ==========================================
  // VINYL INTERACTION
  // ==========================================

  startDrag(event) {
    this.isDragging = true;
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = event.clientX - rect.left - centerX;
    const y = event.clientY - rect.top - centerY;
    this.lastAngle = Math.atan2(y, x);

    this.canvas.style.cursor = 'grabbing';
  }

  drag(event) {
    if (!this.isDragging) return;

    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = event.clientX - rect.left - centerX;
    const y = event.clientY - rect.top - centerY;
    const currentAngle = Math.atan2(y, x);

    // Calculate angle difference
    let deltaAngle = currentAngle - this.lastAngle;

    // Handle angle wrap-around
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    // Update rotation
    this.rotation += deltaAngle * (180 / Math.PI);
    this.lastAngle = currentAngle;

    // Seek audio based on rotation (vinyl scratching effect)
    if (this.audio.duration) {
      const rotationNormalized = (this.rotation % 360 + 360) % 360;
      const newTime = (rotationNormalized / 360) * this.audio.duration;

      // Apply seek with smoothing
      if (Math.abs(this.audio.currentTime - newTime) > 0.1) {
        this.audio.currentTime = newTime;
      }
    }
  }

  endDrag() {
    this.isDragging = false;
    this.canvas.style.cursor = 'pointer';
  }

  // ==========================================
  // VINYL CANVAS RENDERING
  // ==========================================

  drawVinyl() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 10;

    // Get current track data
    const currentTrack = this.tracks[this.currentTrackIndex];
    const colors = currentTrack?.colors || this.getDefaultColors();
    const coverArt = currentTrack?.coverArt;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context
    ctx.save();

    // Rotate canvas for vinyl disc
    ctx.translate(centerX, centerY);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    // Draw vinyl disc with texture if loaded
    if (this.vinylTextureLoaded) {
      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.clip();

      // Draw vinyl texture
      ctx.drawImage(
        this.vinylTexture,
        centerX - radius,
        centerY - radius,
        radius * 2,
        radius * 2
      );

      // Apply color tint based on cover art colors
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = colors.primary;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Add lighter overlay for depth
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = colors.lighter.replace('rgb', 'rgba').replace(')', ', 0.2)');
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    } else {
      // Fallback: Draw vinyl disc with solid color
      ctx.fillStyle = '#4A4A3A';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Draw grooves - visible concentric circles
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 150; i++) {
        const grooveRadius = radius * 0.38 + (i * (radius * 0.62)) / 150;
        ctx.beginPath();
        ctx.arc(centerX, centerY, grooveRadius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    // Draw center label WITH rotation (rotates with vinyl)
    const labelRadius = radius * 0.38;

    if (coverArt && this.coverImage && this.coverImage.complete) {
      // Draw cover art as center label - ROTATES with vinyl
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, labelRadius, 0, 2 * Math.PI);
      ctx.clip();
      ctx.drawImage(
        this.coverImage,
        centerX - labelRadius,
        centerY - labelRadius,
        labelRadius * 2,
        labelRadius * 2
      );
      ctx.restore();

      // Add subtle border to cover
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, labelRadius, 0, 2 * Math.PI);
      ctx.stroke();
    } else {
      // Draw simple colored label (no gradient - Web 1.0 style)
      ctx.fillStyle = '#FF6600';
      ctx.beginPath();
      ctx.arc(centerX, centerY, labelRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Add border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, labelRadius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw center hole
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(centerX, centerY, labelRadius * 0.2, 0, 2 * Math.PI);
    ctx.fill();

    // Inner hole shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, labelRadius * 0.2, 0, 2 * Math.PI);
    ctx.stroke();

    // Restore context
    ctx.restore();
  }

  animateVinyl() {
    this.drawVinyl();
    requestAnimationFrame(() => this.animateVinyl());
  }

  // ==========================================
  // LIBRARY VINYL RENDERING
  // ==========================================

  drawLibraryVinyl(canvasId, track) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 10;

    const colors = track.colors || this.getDefaultColors();

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw vinyl disc with texture if loaded
    if (this.vinylTextureLoaded) {
      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.clip();

      // Draw vinyl texture
      ctx.drawImage(
        this.vinylTexture,
        centerX - radius,
        centerY - radius,
        radius * 2,
        radius * 2
      );

      // Apply color tint based on cover art colors
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = colors.primary;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Add lighter overlay for depth
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = colors.lighter.replace('rgb', 'rgba').replace(')', ', 0.15)');
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    } else {
      // Fallback: Draw vinyl disc with solid color
      ctx.fillStyle = '#4A4A3A';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Draw grooves
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 100; i++) {
        const grooveRadius = radius * 0.38 + (i * (radius * 0.62)) / 100;
        ctx.beginPath();
        ctx.arc(centerX, centerY, grooveRadius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    // Draw center label
    const labelRadius = radius * 0.38;

    if (track.coverArt) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, labelRadius, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(
          img,
          centerX - labelRadius,
          centerY - labelRadius,
          labelRadius * 2,
          labelRadius * 2
        );
        ctx.restore();

        // Add border to cover
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, labelRadius, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw center hole
        this.drawCenterHole(ctx, centerX, centerY, labelRadius);
      };
      img.src = track.coverArt;
    } else {
      // Draw simple colored label
      ctx.fillStyle = '#FF6600';
      ctx.beginPath();
      ctx.arc(centerX, centerY, labelRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Add border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, labelRadius, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw center hole
      this.drawCenterHole(ctx, centerX, centerY, labelRadius);
    }
  }

  drawCenterHole(ctx, centerX, centerY, labelRadius) {
    // Draw center hole
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(centerX, centerY, labelRadius * 0.2, 0, 2 * Math.PI);
    ctx.fill();

    // Inner hole shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, labelRadius * 0.2, 0, 2 * Math.PI);
    ctx.stroke();
  }

  // ==========================================
  // MINI PLAYER
  // ==========================================

  updateMiniPlayer() {
    const miniPlayer = document.getElementById('miniPlayer');
    if (!miniPlayer) return;

    const track = this.tracks[this.currentTrackIndex];

    // Show mini player only when in library view and track is loaded
    if (this.library.classList.contains('hidden') || !track || !this.audio.src) {
      miniPlayer.classList.add('hidden');
      return;
    }

    miniPlayer.classList.remove('hidden');

    // Update track info
    document.getElementById('miniPlayerTitle').textContent = track.title || 'Unknown Track';
    document.getElementById('miniPlayerArtist').textContent = track.artist || 'Unknown Artist';

    // Update cover art
    const coverEl = document.getElementById('miniPlayerCover');
    if (track.coverArt) {
      coverEl.style.backgroundImage = `url('${track.coverArt}')`;
    } else {
      coverEl.style.backgroundImage = '';
      coverEl.style.backgroundColor = '#808080';
    }

    // Update play/pause button
    const miniPlayIcon = document.getElementById('miniPlayIcon');
    const miniPauseIcon = document.getElementById('miniPauseIcon');
    if (this.isPlaying) {
      miniPlayIcon.classList.add('hidden');
      miniPauseIcon.classList.remove('hidden');
    } else {
      miniPlayIcon.classList.remove('hidden');
      miniPauseIcon.classList.add('hidden');
    }
  }
}

// ==========================================
// INITIALIZE APP
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  window.vinylPlayer = new VinylMusicPlayer();
});

// ==========================================
// SERVICE WORKER (Optional - for PWA)
// ==========================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Uncomment to enable PWA features
    // navigator.serviceWorker.register('/sw.js')
    //   .then(reg => console.log('Service Worker registered'))
    //   .catch(err => console.log('Service Worker registration failed'));
  });
}
