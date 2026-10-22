if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker 登録成功:', reg.scope))
            .catch(err => console.error('Service Worker 登録失敗:', err));
    });
}

// -------------------------------------------------------------
// 🎮 タイトル画面＆パーティクル＆効果音ロジック
// -------------------------------------------------------------
const titleScreen = document.getElementById('title-screen');
const whiteFlash = document.getElementById('white-flash');
const backToTitleBtn = document.getElementById('back-to-title-btn');
const sparkleCanvas = document.getElementById('sparkle-canvas');
const sCtx = sparkleCanvas.getContext('2d');

let sparkles = [];
let isTitleActive = true;

// キャンバスリサイズ
function resizeSparkleCanvas() {
    sparkleCanvas.width = window.innerWidth;
    sparkleCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeSparkleCanvas);
resizeSparkleCanvas();

// パーティクル生成
for (let i = 0; i < 35; i++) {
    sparkles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 6 + 2,
        speedY: Math.random() * 0.8 + 0.3,
        speedX: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.8 + 0.2,
        pulse: Math.random() * 0.05 + 0.01,
        type: Math.random() > 0.3 ? 'star' : 'circle'
    });
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

function animateSparkles() {
    if (!isTitleActive) return;
    sCtx.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);

    sparkles.forEach(p => {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.opacity += Math.sin(Date.now() * 0.003) * p.pulse;

        if (p.y < -20) {
            p.y = sparkleCanvas.height + 20;
            p.x = Math.random() * sparkleCanvas.width;
        }

        sCtx.fillStyle = `rgba(255, 235, 245, ${Math.abs(Math.sin(p.opacity))})`;
        if (p.type === 'star') {
            drawStar(sCtx, p.x, p.y, 4, p.size, p.size / 2);
        } else {
            sCtx.beginPath();
            sCtx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            sCtx.fill();
        }
    });

    requestAnimationFrame(animateSparkles);
}
animateSparkles();

// 🔊 ソシャゲ風スタート音（Web Audio API）
function playStartSE() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C E G C E G
        freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.06);

            gain.gain.setValueAtTime(0, now + idx * 0.06);
            gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.06 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.8);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.06);
            osc.stop(now + idx * 0.06 + 0.85);
        });
    } catch (e) {
        console.log("SE再生非対応", e);
    }
}

// 画面スタートイベント
titleScreen.addEventListener('click', () => {
    playStartSE();
    whiteFlash.classList.add('active');

    setTimeout(() => {
        titleScreen.style.opacity = '0';
        setTimeout(() => {
            titleScreen.style.display = 'none';
            isTitleActive = false;
            whiteFlash.classList.remove('active');
            if (map) map.invalidateSize();
        }, 400);
    }, 400);
});

// タイトルへ戻る
backToTitleBtn.addEventListener('click', () => {
    titleScreen.style.display = 'flex';
    titleScreen.style.opacity = '1';
    isTitleActive = true;
    animateSparkles();
});


// -------------------------------------------------------------
// 🐾 メインアプリ機能ロジック
// -------------------------------------------------------------
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/aPPZEVupq/";

const CAT_DB = {
    "kuro": "./cat_img/kuro.png",
    "shiro": "./cat_img/shiro.png",
    "gray": "./cat_img/gray.png",
    "kijitora": "./cat_img/kijitora.png",
    "sabatora": "./cat_img/sabatora.png",
    "chatora": "./cat_img/chatora.png",
    "mike": "./cat_img/mike.png",
    "sabi": "./cat_img/sabi.png",
    "syamu": "./cat_img/syamu.png",
    "buti": "./cat_img/buti.png"
};

const CAT_NAMES = {
    "kuro": "黒猫",
    "shiro": "白猫",
    "gray": "グレー",
    "kijitora": "キジトラ",
    "sabatora": "サバトラ",
    "chatora": "茶トラ",
    "mike": "三毛猫",
    "sabi": "サビ猫",
    "syamu": "シャム猫",
    "buti": "ぶち猫"
};

const DEFAULT_IMG = "./cat_img/kijitora.png";

let map, model, markerClusterGroup;
let catDataList = [];
const markers = [];
let predictionLayerGroup = null;
let heatLayer = null;
let showPrediction = true;
let isMoveMode = false;
let activeTimeFilter = 'all'; 
let targetFutureHour = -1;

const video = document.getElementById('webcam');
const canvas = document.getElementById('capture-canvas');
const aiStatus = document.getElementById('ai-status');

async function init() {
    map = L.map('map').setView([35.681236, 139.767125], 15);

    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
        attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>",
        maxZoom: 18
    }).addTo(map);

    markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 120,
        spiderfyDistanceMultiplier: 1.5,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false
    });
    map.addLayer(markerClusterGroup);

    predictionLayerGroup = L.layerGroup().addTo(map);

    const control = L.control({ position: 'topright' });
    control.onAdd = function () {
        const div = L.DomUtil.create('div', 'leaflet-bar map-control-panel');
        div.style.border = 'none';
        div.style.background = 'transparent';
        div.innerHTML = `
            <select id="future-time-select" class="time-filter-select" style="border-color: #8b5cf6; background: #faf5ff; color: #6b21a8;">
                <option value="-1">🔮 未来予測ヒートマップ：OFF</option>
                <option value="6">🔮 06:00 頃の出現予測</option>
                <option value="9">🔮 09:00 頃の出現予測</option>
                <option value="12">🔮 12:00 頃の出現予測</option>
                <option value="15">🔮 15:00 頃の出現予測</option>
                <option value="18">🔮 18:00 頃の出現予測</option>
                <option value="21">🔮 21:00 頃の出現予測</option>
                <option value="0">🔮 00:00 頃の出現予測</option>
            </select>
            <select id="time-filter-select" class="time-filter-select">
                <option value="all">⏰ 時間帯：すべて表示</option>
                <option value="morning">🌅 朝 (5:00 - 9:59)</option>
                <option value="noon">☀️ 昼 (10:00 - 15:59)</option>
                <option value="evening">🌆 夕 (16:00 - 18:59)</option>
                <option value="night">🌙 夜 (19:00 - 4:59)</option>
            </select>
            <button id="toggle-pred-btn" class="prediction-toggle-btn active">🐾 生息域の予測：ON</button>
            <button id="toggle-move-btn" class="prediction-toggle-btn">🖐️ マーカー移動：OFF</button>
        `;
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        return div;
    };
    control.addTo(map);

    document.addEventListener('change', (e) => {
        if (!e.target) return;
        
        if (e.target.id === 'time-filter-select') {
            activeTimeFilter = e.target.value;
            applyTimeFilter();
        }

        if (e.target.id === 'future-time-select') {
            targetFutureHour = parseInt(e.target.value, 10);
            updateFuturePredictionHeatmap();
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target) return;

        if (e.target.id === 'toggle-pred-btn') {
            showPrediction = !showPrediction;
            const btn = e.target;
            if (showPrediction) {
                btn.classList.add('active');
                btn.innerText = '🐾 生息域の予測：ON';
            } else {
                btn.classList.remove('active');
                btn.innerText = '🐾 生息域の予測：OFF';
            }
            updateHabitatPrediction();
        }

        if (e.target.id === 'toggle-move-btn') {
            isMoveMode = !isMoveMode;
            const btn = e.target;
            if (isMoveMode) {
                btn.classList.add('active');
                btn.innerText = '✋ マーカー移動：ON';
            } else {
                btn.classList.remove('active');
                btn.innerText = '🖐️ マーカー移動：OFF';
            }
            updateMarkerDraggable();
        }
    });

    map.on('zoomend', () => markers.forEach(m => m.marker.setIcon(m.updateSize())));

    loadCatData();

    try {
        aiStatus.textContent = "⚙️ オンラインAIモデル読込中...";
        model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
            .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
        video.srcObject = stream;
        
        aiStatus.textContent = "✅ AI 準備完了";
    } catch (e) {
        aiStatus.innerHTML = "⚠️ <span style='color: #f87171;'>モデル読込エラー</span>";
        console.error(e);
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 16));
    }
}

function getTimeCategory(timestampStr) {
    if (!timestampStr) return 'unknown';
    const dateObj = new Date(timestampStr.replace(/-/g, '/'));
    if (isNaN(dateObj.getTime())) return 'unknown';

    const hour = dateObj.getHours();
    if (hour >= 5 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 16) return 'noon';
    if (hour >= 16 && hour < 19) return 'evening';
    return 'night';
}

function updateFuturePredictionHeatmap() {
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }

    if (targetFutureHour === -1 || catDataList.length === 0) return;

    const heatPoints = [];

    catDataList.forEach(c => {
        if (!c.timestamp) return;
        const dateObj = new Date(c.timestamp.replace(/-/g, '/'));
        if (isNaN(dateObj.getTime())) return;

        const recordedHour = dateObj.getHours();
        
        let hourDiff = Math.abs(recordedHour - targetFutureHour);
        if (hourDiff > 12) hourDiff = 24 - hourDiff;

        if (hourDiff <= 4) {
            const weight = Math.pow(0.6, hourDiff);
            heatPoints.push([c.lat, c.lng, weight]);
        }
    });

    if (heatPoints.length > 0) {
        heatLayer = L.heatLayer(heatPoints, {
            radius: 45,
            blur: 25,
            maxZoom: 16,
            minOpacity: 0.35,
            gradient: {
                0.2: '#00f2fe',
                0.5: '#38ef7d',
                0.8: '#ffeb3b',
                1.0: '#ff3300'
            }
        }).addTo(map);
    }
}

function applyTimeFilter() {
    markers.forEach(m => {
        const catObj = catDataList.find(c => c.id === m.id);
        const category = catObj ? getTimeCategory(catObj.timestamp) : 'unknown';

        const isMatch = (activeTimeFilter === 'all' || category === activeTimeFilter);

        if (isMatch) {
            if (isMoveMode) {
                if (!map.hasLayer(m.marker)) map.addLayer(m.marker);
            } else {
                if (!markerClusterGroup.hasLayer(m.marker)) markerClusterGroup.addLayer(m.marker);
            }
            if (m.circle && !map.hasLayer(m.circle)) map.addLayer(m.circle);
        } else {
            if (markerClusterGroup.hasLayer(m.marker)) markerClusterGroup.removeLayer(m.marker);
            if (map.hasLayer(m.marker)) map.removeLayer(m.marker);
            if (m.circle && map.hasLayer(m.circle)) map.removeLayer(m.circle);
        }
    });

    updateHabitatPrediction();
}

function updateMarkerDraggable() {
    const mapEl = document.getElementById('map');
    
    if (isMoveMode) {
        mapEl.classList.add('move-mode-active');
    } else {
        mapEl.classList.remove('move-mode-active');
    }

    markers.forEach(m => {
        const catObj = catDataList.find(c => c.id === m.id);
        const category = catObj ? getTimeCategory(catObj.timestamp) : 'unknown';
        const isMatch = (activeTimeFilter === 'all' || category === activeTimeFilter);

        if (!isMatch) return;

        if (isMoveMode) {
            if (markerClusterGroup.hasLayer(m.marker)) markerClusterGroup.removeLayer(m.marker);
            if (!map.hasLayer(m.marker)) map.addLayer(m.marker);
            
            m.marker.closePopup();
            m.marker.unbindPopup();
            if (m.marker.dragging) m.marker.dragging.enable();
        } else {
            if (map.hasLayer(m.marker)) map.removeLayer(m.marker);
            if (!markerClusterGroup.hasLayer(m.marker)) markerClusterGroup.addLayer(m.marker);

            if (m.marker.dragging) m.marker.dragging.disable();
            if (catObj) m.marker.bindPopup(getPopupContent(catObj));
        }
    });
}

function getPopupContent(catItem) {
    const dateInfo = catItem.timestamp ? `📅 ${catItem.timestamp}` : '日時記録なし';
    return `
        <div style="text-align:center; padding: 4px;">
            <b style="font-size: 13px; color: #0f172a;">🐈 ${CAT_NAMES[catItem.typeKey] || catItem.typeKey}</b><br>
            <small style="color: #64748b; font-size: 10px;">${dateInfo}</small><br>
            <button class="delete-btn" onclick="removeCat(${catItem.id})">🗑️ この猫を削除</button>
        </div>
    `;
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn, .page-content').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        
        let target = 'map-container';
        if (btn.id === 'tab-camera') target = 'camera-container';
        if (btn.id === 'tab-book') {
            target = 'book-container';
            renderBookView();
        }
        if (btn.id === 'tab-analysis') {
            target = 'analysis-container';
            renderAnalysisView();
        }
        if (btn.id === 'tab-history') {
            target = 'history-container';
            renderHistoryList();
        }

        document.getElementById(target).classList.add('active');
        if (btn.id === 'tab-map') {
            setTimeout(() => map.invalidateSize(), 200);
        }
    });
});

document.getElementById('snap-btn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert("GPSに対応していません。");
    if (!model) return alert("AIモデルの準備が完了していません。");

    aiStatus.textContent = "📍 解析中...";

    navigator.geolocation.getCurrentPosition(async pos => {
        const vWidth = video.videoWidth;
        const vHeight = video.videoHeight;
        
        const innerWidth = 696 * 0.764;
        const innerHeight = 928 * 0.789;
        const targetAspect = innerWidth / innerHeight;
        
        let sWidth = vWidth;
        let sHeight = vHeight;
        let sx = 0;
        let sy = 0;

        if (vWidth / vHeight > targetAspect) {
            sWidth = vHeight * targetAspect;
            sx = (vWidth - sWidth) / 2;
        } else {
            sHeight = vWidth / targetAspect;
            sy = (vHeight - sHeight) / 2;
        }

        canvas.width = Math.round(innerWidth);
        canvas.height = Math.round(innerHeight);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

        const predictions = await model.predict(canvas);
        let best = predictions.reduce((prev, current) => (prev.probability > current.probability) ? prev : current);

        const now = new Date();
        const formattedDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newCat = {
            id: Date.now(),
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            typeKey: best.className,
            timestamp: formattedDate
        };

        catDataList.push(newCat);
        saveCatData();

        createMarkerOnMap(newCat);
        updateHabitatPrediction();
        updateFuturePredictionHeatmap();

        document.getElementById('tab-map').click();
        aiStatus.textContent = "✅ 判定完了";
    }, () => {
        alert("位置情報の取得に失敗しました。");
        aiStatus.textContent = "❌ 解析失敗";
    });
});

function getMarkerHtml(typeKey, size) {
    const imgPath = CAT_DB[typeKey] || DEFAULT_IMG;

    return `
        <div style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; user-select: none; -webkit-user-select: none;">
            <img src="${imgPath}" draggable="false" style="
                width: 100%; height: 100%; object-fit: contain; 
                filter: drop-shadow(0px 4px 8px rgba(0,0,0,0.25));
                image-rendering: pixelated;
                pointer-events: none;
                -webkit-user-drag: none;
            ">
        </div>
    `;
}

function createMarkerOnMap(catItem) {
    const circle = L.circle([catItem.lat, catItem.lng], {
        radius: 500,
        color: '#64748b',
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: '#94a3b8',
        fillOpacity: 0.08
    }).addTo(map);

    const baseSize = 80;
    const updateSize = () => {
        const scale = Math.pow(2, (map.getZoom() - 16) * 0.75);
        const size = baseSize * scale;
        return L.divIcon({
            html: getMarkerHtml(catItem.typeKey, size),
            className: 'custom-cat-icon',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
    };

    const marker = L.marker([catItem.lat, catItem.lng], { 
        icon: updateSize(),
        draggable: isMoveMode 
    });

    if (isMoveMode) {
        map.addLayer(marker);
        if (marker.dragging) marker.dragging.enable();
    } else {
        marker.bindPopup(getPopupContent(catItem));
        markerClusterGroup.addLayer(marker);
        if (marker.dragging) marker.dragging.disable();
    }

    marker.on('dragend', function (e) {
        const newPos = e.target.getLatLng();
        const catObj = catDataList.find(c => c.id === catItem.id);
        if (catObj) {
            catObj.lat = newPos.lat;
            catObj.lng = newPos.lng;
            saveCatData();
        }
        circle.setLatLng(newPos);
        updateHabitatPrediction();
        updateFuturePredictionHeatmap();
    });

    markers.push({ id: catItem.id, marker, circle, typeKey: catItem.typeKey, updateSize });
}

function renderBookView() {
    const allTypes = Object.keys(CAT_NAMES);
    const totalTypes = allTypes.length;

    const countsMap = {};
    catDataList.forEach(c => {
        countsMap[c.typeKey] = (countsMap[c.typeKey] || 0) + 1;
    });

    const discoveredTypes = Object.keys(countsMap).length;
    const compPercent = Math.round((discoveredTypes / totalTypes) * 100);

    document.getElementById('comp-text').innerText = `${discoveredTypes} / ${totalTypes} 種類 (${compPercent}%)`;
    document.getElementById('comp-bar').style.width = `${compPercent}%`;

    const hasNightCat = catDataList.some(c => getTimeCategory(c.timestamp) === 'night');
    const badges = [
        { id: 'b1', icon: '🐾', title: 'はじめの一歩', desc: '1匹目を登録', unlocked: catDataList.length >= 1 },
        { id: 'b2', icon: '⭐', title: 'ハーフコンプ', desc: '5種類達成', unlocked: discoveredTypes >= 5 },
        { id: 'b3', icon: '👑', title: '図鑑マスター', desc: '全10種コンプ', unlocked: discoveredTypes >= 10 },
        { id: 'b4', icon: '🌙', title: '夜猫ハンター', desc: '夜間に発見', unlocked: hasNightCat }
    ];

    const badgeContainer = document.getElementById('badge-container');
    badgeContainer.innerHTML = '';
    badges.forEach(b => {
        const badgeEl = document.createElement('div');
        badgeEl.className = `badge-item ${b.unlocked ? 'unlocked' : ''}`;
        badgeEl.innerHTML = `
            <div class="badge-icon">${b.icon}</div>
            <div style="font-weight:700;">${b.title}</div>
            <div style="font-size:0.65rem; color:#94a3b8;">${b.desc}</div>
        `;
        badgeContainer.appendChild(badgeEl);
    });

    const bookGrid = document.getElementById('book-grid-view');
    bookGrid.innerHTML = '';

    allTypes.forEach(typeKey => {
        const count = countsMap[typeKey] || 0;
        const isUnlocked = count > 0;
        const name = CAT_NAMES[typeKey];
        const imgPath = CAT_DB[typeKey] || DEFAULT_IMG;

        const card = document.createElement('div');
        card.className = `book-card ${isUnlocked ? '' : 'locked'}`;
        card.innerHTML = `
            <div class="book-lock-icon">${isUnlocked ? '✅' : '🔒'}</div>
            <img src="${imgPath}" alt="${name}">
            <div class="book-name">${isUnlocked ? name : '？？？？'}</div>
            <div class="book-count">${isUnlocked ? `発見: \${count}回` : '未発見'}</div>
        `;
        bookGrid.appendChild(card);
    });
}

function renderAnalysisView() {
    const total = catDataList.length;
    if (total === 0) {
        document.getElementById('insight-text-content').innerHTML = "まだ猫が登録されていません。カメラで猫を撮影してデータを蓄積してみましょう！";
        ['morning', 'noon', 'evening', 'night'].forEach(k => {
            document.getElementById(`cnt-${k}`).innerText = '0件 (0%)';
            document.getElementById(`bar-${k}`).style.width = '0%';
        });
        document.getElementById('weekday-grid-view').innerHTML = '';
        return;
    }

    const timeCounts = { morning: 0, noon: 0, evening: 0, night: 0 };
    const timeCats = { morning: {}, noon: {}, evening: {}, night: {} };
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

    catDataList.forEach(item => {
        const category = getTimeCategory(item.timestamp);
        if (timeCounts[category] !== undefined) {
            timeCounts[category]++;
            timeCats[category][item.typeKey] = (timeCats[category][item.typeKey] || 0) + 1;
        }

        if (item.timestamp) {
            const d = new Date(item.timestamp.replace(/-/g, '/'));
            if (!isNaN(d.getTime())) {
                weekdayCounts[d.getDay()]++;
            }
        }
    });

    const timeNames = { morning: '朝', noon: '昼', evening: '夕方', night: '夜' };
    Object.keys(timeCounts).forEach(key => {
        const cnt = timeCounts[key];
        const pct = Math.round((cnt / total) * 100);
        document.getElementById(`cnt-${key}`).innerText = `${cnt}件 (${pct}%)`;
        document.getElementById(`bar-${key}`).style.width = `${pct}%`;
    });

    const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    const maxWeekday = Math.max(...weekdayCounts, 1);
    const gridView = document.getElementById('weekday-grid-view');
    gridView.innerHTML = '';

    weekdayLabels.forEach((label, i) => {
        const cnt = weekdayCounts[i];
        const heightPct = Math.round((cnt / maxWeekday) * 100);
        
        const col = document.createElement('div');
        col.className = 'weekday-col';
        col.innerHTML = `
            <div class="weekday-count">${cnt}</div>
            <div class="weekday-bar-track">
                <div class="weekday-bar-fill" style="height: ${heightPct}%;"></div>
            </div>
            <div class="weekday-name">${label}</div>
        `;
        gridView.appendChild(col);
    });

    let topTimeKey = Object.keys(timeCounts).reduce((a, b) => timeCounts[a] > timeCounts[b] ? a : b);
    let nightCats = timeCats.night;
    let topNightCatKey = Object.keys(nightCats).reduce((a, b) => nightCats[a] > nightCats[b] ? a : b, null);

    let insightHtml = `このエリアでは **${timeNames[topTimeKey]}**（目撃率 ${Math.round(timeCounts[topTimeKey]/total*100)}%）に最も多く猫が発見されています。`;
    
    if (topNightCatKey && timeCounts.night > 0) {
        insightHtml += `<br>🌙 夜間は特に **${CAT_NAMES[topNightCatKey] || topNightCatKey}** の目撃割合が高くなっています。`;
    }
    if (timeCounts.noon > timeCounts.night) {
        insightHtml += `<br>☀️ 昼間の目撃が多いため、日当たりが良い場所（公園や空き地）でお昼寝しているケースが多い可能性があります。`;
    }

    document.getElementById('insight-text-content').innerHTML = insightHtml;
}

function renderHistoryList() {
    const container = document.getElementById('history-list-view');
    container.innerHTML = '';

    if (catDataList.length === 0) {
        container.innerHTML = `<div class="empty-state">登録された猫の履歴はありません</div>`;
        return;
    }

    const sortedList = [...catDataList].reverse();

    sortedList.forEach(item => {
        const imgPath = CAT_DB[item.typeKey] || DEFAULT_IMG;
        const name = CAT_NAMES[item.typeKey] || item.typeKey;
        const time = item.timestamp || '日時不明';
        const lat = item.lat.toFixed(5);
        const lng = item.lng.toFixed(5);

        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
            <img src="${imgPath}" alt="${name}">
            <div class="history-info">
                <div class="history-name">🐈 ${name}</div>
                <div class="history-meta">
                    📅 ${time}<br>
                    📍 緯度: ${lat}, 経度: ${lng}
                </div>
            </div>
            <div class="history-action">
                <button class="btn-sm btn-focus" onclick="focusOnMap(${item.id})">地図で見る</button>
                <button class="btn-sm btn-delete" onclick="removeCat(${item.id})">削除</button>
            </div>
        `;
        container.appendChild(card);
    });
}

window.focusOnMap = function(catId) {
    const cat = catDataList.find(c => c.id === catId);
    if (!cat) return;

    document.getElementById('tab-map').click();
    map.setView([cat.lat, cat.lng], 17);

    const mObj = markers.find(m => m.id === catId);
    if (mObj) {
        setTimeout(() => {
            mObj.marker.openPopup();
        }, 300);
    }
};

function updateHabitatPrediction() {
    predictionLayerGroup.clearLayers();

    if (!showPrediction || catDataList.length === 0) return;

    const filteredCats = catDataList.filter(c => {
        if (activeTimeFilter === 'all') return true;
        return getTimeCategory(c.timestamp) === activeTimeFilter;
    });

    if (filteredCats.length === 0) return;

    const categorizedCats = {};
    filteredCats.forEach(c => {
        if (!categorizedCats[c.typeKey]) {
            categorizedCats[c.typeKey] = [];
        }
        categorizedCats[c.typeKey].push(c);
    });

    Object.keys(categorizedCats).forEach(typeKey => {
        const catsOfType = categorizedCats[typeKey];
        const clusters = [];
        const visited = new Set();

        for (let i = 0; i < catsOfType.length; i++) {
            if (visited.has(i)) continue;
            const cluster = [catsOfType[i]];
            visited.add(i);

            const queue = [catsOfType[i]];
            while (queue.length > 0) {
                const curr = queue.shift();
                const ptCurr = turf.point([curr.lng, curr.lat]);

                for (let j = 0; j < catsOfType.length; j++) {
                    if (visited.has(j)) continue;
                    const ptOther = turf.point([catsOfType[j].lng, catsOfType[j].lat]);
                    const dist = turf.distance(ptCurr, ptOther, { units: 'kilometers' });
                    if (dist <= 0.5) {
                        visited.add(j);
                        cluster.push(catsOfType[j]);
                        queue.push(catsOfType[j]);
                    }
                }
            }
            clusters.push(cluster);
        }

        clusters.forEach(cluster => {
            const points = turf.featureCollection(
                cluster.map(c => turf.point([c.lng, c.lat]))
            );
            const catName = CAT_NAMES[typeKey] || typeKey;

            if (cluster.length === 1) {
                const singleCircle = turf.buffer(points.features[0], 0.5, { units: 'kilometers' });
                L.geoJSON(singleCircle, {
                    style: {
                        color: '#ec4899',
                        weight: 2,
                        fillColor: '#f472b6',
                        fillOpacity: 0.18
                    }
                }).bindTooltip(`🐾 ${catName} (単独)`, { sticky: true }).addTo(predictionLayerGroup);
            } else {
                const centroid = turf.centroid(points);

                let maxDist = 0;
                cluster.forEach(c => {
                    const dist = turf.distance(centroid, turf.point([c.lng, c.lat]), { units: 'kilometers' });
                    if (dist > maxDist) maxDist = dist;
                });

                const bigCircle = turf.circle(centroid, maxDist + 0.5, { units: 'kilometers' });

                L.geoJSON(bigCircle, {
                    style: {
                        color: '#a855f7',
                        weight: 2,
                        dashArray: '6, 6',
                        fillColor: '#c084fc',
                        fillOpacity: 0.18
                    }
                }).bindTooltip(`🐾 ${catName} 集団領域 (${cluster.length}匹)`, { sticky: true }).addTo(predictionLayerGroup);
            }
        });
    });
}

window.removeCat = function(catId) {
    catDataList = catDataList.filter(item => item.id !== catId);
    saveCatData();

    const idx = markers.findIndex(m => m.id === catId);
    if (idx !== -1) {
        if (markerClusterGroup.hasLayer(markers[idx].marker)) {
            markerClusterGroup.removeLayer(markers[idx].marker);
        }
        if (map.hasLayer(markers[idx].marker)) {
            map.removeLayer(markers[idx].marker);
        }
        if (markers[idx].circle) {
            map.removeLayer(markers[idx].circle);
        }
        markers.splice(idx, 1);
    }

    updateHabitatPrediction();
    updateFuturePredictionHeatmap();

    if (document.getElementById('book-container').classList.contains('active')) {
        renderBookView();
    }
    if (document.getElementById('history-container').classList.contains('active')) {
        renderHistoryList();
    }
    if (document.getElementById('analysis-container').classList.contains('active')) {
        renderAnalysisView();
    }
};

function saveCatData() {
    localStorage.setItem("registered_cats", JSON.stringify(catDataList));
}

function loadCatData() {
    const data = localStorage.getItem("registered_cats");
    if (data) {
        catDataList = JSON.parse(data);
        catDataList.forEach(catItem => createMarkerOnMap(catItem));
        updateHabitatPrediction();
        updateFuturePredictionHeatmap();
    }
}

init();