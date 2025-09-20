mapboxgl.accessToken = 'pk.eyJ1IjoiYnJzYWx2MjAwNiIsImEiOiJjbWU0cnA2dGIwZGdzMmxxdHN3aXFla3FhIn0.olUF6dEN497eCVOaaMnBow';

let map;
const loader = document.getElementById('loader');
const errorContainer = document.getElementById('error-container');
const isMobile = window.matchMedia("(max-width: 1024px)").matches;
let webWorkersFinished = { fire: false };

const baseLayerButtons = {};
let overlayLayers = [];
const overlayButtons = {};

let fireMarkers = {};
let detailsChart = null;
let baseLayerButtonsContainer, fireButtonsContainer;

const baseLayers = [
    { name: 'Standard - Default - Dawn', layer: 'mapbox://styles/mapbox/standard', style: 'dawn', theme: 'default' },
    { name: 'Standard - Default - Day', layer: 'mapbox://styles/mapbox/standard', style: 'day', theme: 'default' },
    { name: 'Standard - Default - Dusk', layer: 'mapbox://styles/mapbox/standard', style: 'dusk', theme: 'default' },
    { name: 'Standard - Default - Night', layer: 'mapbox://styles/mapbox/standard', style: 'night', theme: 'default' },
    { name: 'Standard - Faded - Dawn', layer: 'mapbox://styles/mapbox/standard', style: 'dawn', theme: 'faded' },
    { name: 'Standard - Faded - Day', layer: 'mapbox://styles/mapbox/standard', style: 'day', theme: 'faded' },
    { name: 'Standard - Faded - Dusk', layer: 'mapbox://styles/mapbox/standard', style: 'dusk', theme: 'faded' },
    { name: 'Standard - Faded - Night', layer: 'mapbox://styles/mapbox/standard', style: 'night', theme: 'faded' },
    { name: 'Standard - Monochrome - Dawn', layer: 'mapbox://styles/mapbox/standard', style: 'dawn', theme: 'monochrome' },
    { name: 'Standard - Monochrome - Day', layer: 'mapbox://styles/mapbox/standard', style: 'day', theme: 'monochrome' },
    { name: 'Standard - Monochrome - Dusk', layer: 'mapbox://styles/mapbox/standard', style: 'dusk', theme: 'monochrome' },
    { name: 'Standard - Monochrome - Night', layer: 'mapbox://styles/mapbox/standard', style: 'night', theme: 'monochrome' },
    { name: 'Satellite - Dawn', layer: 'mapbox://styles/mapbox/standard-satellite', style: 'dawn' },
    { name: 'Satellite - Day', layer: 'mapbox://styles/mapbox/standard-satellite', style: 'day' },
    { name: 'Satellite - Dusk', layer: 'mapbox://styles/mapbox/standard-satellite', style: 'dusk' },
    { name: 'Satellite - Night', layer: 'mapbox://styles/mapbox/standard-satellite', style: 'night' }
];

const fireLayers = [
    { name: 'Despacho', id: 3, active: true },
    { name: 'Despacho de 1º Alerta', id: 4, active: true },
    { name: 'Em Curso', id: 5, active: true },
    { name: 'Chegada ao TO', id: 6, active: true },
    { name: 'Em Resolução', id: 7, active: true },
    { name: 'Conclusão', id: 8, active: false },
    { name: 'Vigilância', id: 9, active: false },
    { name: 'Encerrada', id: 10, active: false },
    { name: 'Falso Alarme', id: 11, active: false },
    { name: 'Falso Alerta', id: 12, active: false }
];

function deviceFlyTo(lng, lat) {
    if (isMobile) {
        map.flyTo({
            center: [lng, lat - 0.25], zoom: 9
        });
    } else {
        map.flyTo({
            center: [lng, lat], zoom: 9
        });
    }
}

function showErrorMessage(message) {
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = message;
    errorContainer.appendChild(errorMessage);
    setTimeout(() => errorMessage.remove(), 5000);
};

async function fetchDetails(id) {
    try {
        const response = await fetch(`https://api.fogos.pt/fires/data?id=${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const canvas = document.getElementById('fireChart');
        const ctx = canvas.getContext('2d');
        if (detailsChart) {
            detailsChart.destroy();
        }
        if (data.success && data.data && data.data.length) {
            const labels = data.data.map(d => d.label);
            const man = data.data.map(d => d.man);
            const terrain = data.data.map(d => d.terrain);
            const aerial = data.data.map(d => d.aerial);
            detailsChart = new Chart(ctx, {
                type: 'line', data: {
                    labels: labels, datasets: [{
                        label: 'Operacionais', data: man, fill: false, backgroundColor: '#EFC800', borderColor: '#EFC800', tension: 0.1
                    }, {
                        label: 'Terrestres', data: terrain, fill: false, backgroundColor: '#6D720B', borderColor: '#6D720B', tension: 0.1
                    }, {
                        label: 'Aéreos', data: aerial, fill: false, backgroundColor: '#4E88B2', borderColor: '#4E88B2', tension: 0.1
                    }]
                }, options: {
                    responsive: true, maintainAspectRatio: false, plugins: {
                        legend: {
                            display: true, position: 'top'
                        }
                    }, scales: {
                        x: {
                            beginAtZero: true
                        }, y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            canvas.style.display = 'block';
        } else {
            canvas.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching fire data for chart:', error);
        if (detailsChart) {
            detailsChart.destroy();
        }
        document.getElementById('fireChart').style.display = 'none';
        showErrorMessage(`Erro ao carregar dados do gráfico: ${error.message}`);
    }

    [
        { url: `https://fogos.pt/views/extra/${id}`, selector: '.f-extra', toggleClass: 'active' },
        { url: `https://fogos.pt/views/status/${id}`, selector: '.f-status' },
    ].forEach(async ({ url, selector, toggleClass = null }) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            let data = await response.text();
            const element = document.querySelector(selector);
            const parentRow = element ? element.closest('.card') : null;
            if (data && (data.trim().length > 2)) {
                element.innerHTML = data.replace(/\s<img[\s\S]*\/>/, '');
                if (parentRow && toggleClass) {
                    parentRow.classList.add(toggleClass);
                }
            } else {
                element.innerHTML = '';
                if (parentRow && toggleClass) {
                    parentRow.classList.remove(toggleClass);
                }
            }
        } catch (error) {
            console.error(`Error fetching data for ${selector}:`, error);
            showErrorMessage(`Erro ao carregar dados para ${selector}: ${error.message}`);
            const element = document.querySelector(selector);
            const parentRow = element ? element.closest('.row') : null;
            if (element) {
                element.innerHTML = '';
            }
            if (parentRow && toggleClass) {
                parentRow.classList.remove(toggleClass);
            }
        }
    });
}

function fetchFire() {
    fireLayers.forEach((layer) => {
        overlayLayers.push({ name: layer.name, id: layer.id, icon: 'img/fire.png', active: layer.active, category: 'fire' });
    });

    let fireWorker = new Worker('js/worker.js');
    fireWorker.postMessage({ type: 'fireData' });
    fireWorker.onmessage = (event) => {
        const { type, data } = event.data;
        if (type === 'fireDataComplete') {
            loader.innerText = 'A adicionar dados dos incêndios...';
            for (const statusCode in fireMarkers) {
                fireMarkers[statusCode].forEach(marker => marker.remove());
            }
            fireMarkers = {};
            data.forEach(fire => {
                const statusConfig = fireLayers.find(layer => layer.id === fire.statusCode);
                if (!statusConfig) {
                    console.warn(`Unknown fire status code: ${fire.statusCode}`);
                    return;
                }

                if (fire.lat && fire.lng) {
                    let fireClass;
                    if (fire.important && fire.statusCode >= 7) {
                        fireClass = 'dot status-99-r';
                    } else if (fire.important) {
                        fireClass = 'dot status-99';
                    } else {
                        fireClass = `dot status-${fire.statusCode}`;
                    }

                    const element = document.createElement('div');
                    element.className = 'fire-marker';
                    element.innerHTML = `<i class='${fireClass}' id='fire-${fire.id}'></i>`;
                    element.style.width = '22px';
                    element.style.height = '22px';


                    const layer = fireLayers.find(layer => layer.id === fire.statusCode);
                    if (!layer.active) {
                        element.style.display = 'none';
                    }

                    const marker = new mapboxgl.Marker({
                        element: element, anchor: 'center'
                    }).setLngLat([fire.lng, fire.lat]).addTo(map);

                    if (!fireMarkers[fire.statusCode]) {
                        fireMarkers[fire.statusCode] = [];
                    }
                    fireMarkers[fire.statusCode].push(marker);

                    element.addEventListener('click', async (event) => {
                        event.stopPropagation();

                        const newActiveFire = element.querySelector('.dot');
                        const oldActiveFire = document.querySelector('.dot-active');
                        if (oldActiveFire && oldActiveFire !== newActiveFire) {
                            oldActiveFire.classList.remove('dot-active');
                        }
                        newActiveFire.classList.add('dot-active');

                        deviceFlyTo(fire.lng, fire.lat);
                        document.querySelector('.f-local').innerHTML = fire.location;
                        document.querySelector('.f-man').textContent = fire.man;
                        document.querySelector('.f-aerial').textContent = fire.aerial;
                        document.querySelector('.f-terrain').textContent = fire.terrain;
                        document.querySelector('.f-location').innerHTML = `<a href='https://www.google.com/maps/search/${fire.lat},${fire.lng}' target='_blank' rel='noopener noreferrer'>${fire.lat},${fire.lng}</a>`;
                        document.querySelector('.f-nature').textContent = fire.natureza;
                        document.querySelector('.f-update').textContent = fire.updated;
                        document.querySelector('.f-start').textContent = fire.startDate;
                        await fetchDetails(fire.id);

                        document.body.classList.add('sidebar-open');
                        document.querySelector('.sidebar').classList.add('active');
                        window.history.pushState('ocorrencia', '', `?ocorrencia=${fire.id}`);
                    }, {
                        passive: true
                    });

                    const isActive = (new URLSearchParams(window.location.search)).get('ocorrencia') === fire.id.toString();
                    if (isActive) {
                        element.click();
                    }
                }
            });
            webWorkersFinished.fire = true;
        }
    };
}

const createCategoryDropdown = (title, parent) => {
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'layer-dropdown';

    const toggleButton = document.createElement('button');
    toggleButton.className = 'dropdown-toggle dropdown-toggle-button';
    toggleButton.innerHTML = `${title}`;

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';

    if (isMobile) {
        document.body.appendChild(menu);
        map.on('click', () => {
            menu.classList.remove('open');
            toggleButton.classList.remove('active');
        });
    } else {
        dropdownContainer.appendChild(menu);
    }

    toggleButton.addEventListener('click', (e) => {
        e.stopPropagation();

        if (isMobile) {
            const isOpen = menu.classList.contains('open');
            document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
            document.querySelectorAll('.dropdown-toggle-button.active').forEach(t => t.classList.remove('active'));

            if (!isOpen) {
                menu.classList.add('open');
                toggleButton.classList.add('active');
            }
        } else {
            document.querySelectorAll('.layer-dropdown.open').forEach(d => {
                if (d !== dropdownContainer) d.classList.remove('open');
            });
            dropdownContainer.classList.toggle('open');
        }
    });

    dropdownContainer.appendChild(toggleButton);
    parent.appendChild(dropdownContainer);
    return menu;
};

function initializeLayerBar() {
    const layerBar = document.getElementById('layer-bar');
    if (!layerBar) return;
    baseLayerButtonsContainer = createCategoryDropdown('Camadas Base', layerBar);
    fireButtonsContainer = createCategoryDropdown('Incêndios', layerBar);
    window.addEventListener('click', () => {
        document.querySelectorAll('.layer-dropdown.open').forEach(d => d.classList.remove('open'));
    });
}

function updateBaseLayerButtonState(activeLayerName) {
    for (const layerName in baseLayerButtons) {
        baseLayerButtons[layerName].classList.toggle('active', layerName === activeLayerName);
    }
}

function rebuildOverlayControls() {
    [fireButtonsContainer].forEach(container => {
        container.innerHTML = '';
    });

    for (const key in overlayButtons) {
        delete overlayButtons[key];
    }

    const layerBar = document.getElementById('layer-bar');
    overlayLayers.forEach(layer => {
        const button = document.createElement('button');
        button.classList.toggle('active', layer.active);
        button.dataset.category = layer.category;
        button.dataset.layerId = layer.id;

        button.addEventListener('click', () => {
            const { category, layerId } = button.dataset;
            if (category === 'fire') {
                layer.active = !layer.active;
                overlayButtons[layerId]?.classList.toggle('active', layer.active);
                if (fireMarkers[layerId]) {
                    fireMarkers[layerId].forEach(marker => {
                        marker.getElement().style.display = layer.active ? 'block' : 'none';
                    });
                }
			}
        }, {
            passive: true
        });
        const appendButton = (container) => {
            if (container) container.appendChild(button);
        };
        if (layer.category === 'fire') {
            button.innerHTML = `<img src='${layer.icon}' srcset='${layer.icon} 22w, ${layer.icon.replace(".png", "_33.png")} 33w' alt='layer icon'>${layer.name}`;
            appendButton(fireButtonsContainer);
        }
        overlayButtons[layer.id] = button;
    });
}

function reapplyOverlayLayers() {
    overlayLayers.forEach(layer => {
        if (layer.category === 'fire') {
            if (fireMarkers[layer.id]) {
                fireMarkers[layer.id].forEach(marker => {
                    marker.getElement().style.display = layer.active ? 'block' : 'none';
                });
            }
        }
    });
}

function setupBaseLayerButtons() {
    if (!baseLayerButtonsContainer) return;
    baseLayerButtonsContainer.innerHTML = '';

    baseLayers.forEach(layer => {
        const button = document.createElement('button');
        button.id = layer.layer;
        button.innerHTML = `<img src='img/map.png' alt='map icon'>${layer.name}`;
        button.addEventListener('click', () => {
            let activeLayer = document.querySelector("#layer-bar > div.layer-dropdown.open > div > button.active")
            if (layer.layer === activeLayer.id) {
                map.setConfigProperty('basemap', 'theme', layer.theme || 'default');
                map.setConfigProperty('basemap', 'lightPreset', layer.style || 'day');
            } else {
                map.setStyle(layer.layer, {
                    config: {
                        basemap: {
                            lightPreset: layer.style || 'day', theme: layer.theme || 'default'
                        }
                    }
                });
                map.once('styledata', () => {
                    reapplyOverlayLayers();
                    rebuildOverlayControls();

                    map.on('style.load', () => {
                        if (!map.getSource('mapbox-dem')) {
                            map.addSource('mapbox-dem', {
                                type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14
                            });
                        }
                        map.setTerrain({
                            'source': 'mapbox-dem',
                            'exaggeration': 1
                        });
                    });
                });
            }
            updateBaseLayerButtonState(layer.name);
        }, {
            passive: true
        });
        baseLayerButtonsContainer.appendChild(button);
        baseLayerButtons[layer.name] = button;
    });
}

async function initializeMap() {
    map = new mapboxgl.Map({
        container: 'map',
        style: baseLayers.find(layer => layer.name === 'Standard - Default - Day').layer,
        projection: 'globe',
        center: [-7.8536599, 39.557191],
        pitch: 0,
        bearing: 0,
        zoom: 6
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserHeading: true }), 'top-left');

    map.on('load', async () => {
        initializeLayerBar();
        setupBaseLayerButtons();
        fetchFire();
        while (!(webWorkersFinished.fire)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        rebuildOverlayControls();
        updateBaseLayerButtonState('Standard - Default - Day');
        loader.style.display = 'none';
    });

    map.on('click', () => {
        const activeFire = document.querySelector('.dot-active');
        if (activeFire) {
            activeFire.classList.remove('dot-active');
        }
        document.body.classList.remove('sidebar-open');
        document.querySelector('.sidebar').classList.remove('active');
        map.flyTo({
            center: [-7.8536599, 39.557191],
            pitch: 0,
            bearing: 0,
            zoom: 6
        });
        window.history.pushState('fogo', '', window.location.href.split('?')[0]);
    });

    map.once('style.load', () => {
        map.setTerrain({
            'exaggeration': 1
        });
    });
}

window.onload = async () => {
    loader.style.display = 'block';
    initializeMap();
};