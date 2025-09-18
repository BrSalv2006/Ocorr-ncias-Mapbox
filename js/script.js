mapboxgl.accessToken = 'pk.eyJ1IjoiYnJzYWx2MjAwNiIsImEiOiJjbWU0cnA2dGIwZGdzMmxxdHN3aXFla3FhIn0.olUF6dEN497eCVOaaMnBow';
let map;
let currentWorker = null;
const loader = document.getElementById('loader');
const errorContainer = document.getElementById('error-container');
let allFireMarkersByStatus = {};
let detailsChart = null;
const isMobile = window.matchMedia("(max-width: 1024px)").matches;
const BASE_FIRE_SIZE = 22;

const fireStatusLayers = {
	'Despacho': {
		statusCode: 3, icon: 'img/fire.png', defaultActive: true
	}, 'Despacho de 1º Alerta': {
		statusCode: 4, icon: 'img/fire.png', defaultActive: true
	}, 'Em Curso': {
		statusCode: 5, icon: 'img/fire.png', defaultActive: true
	}, 'Chegada ao TO': {
		statusCode: 6, icon: 'img/fire.png', defaultActive: true
	}, 'Em Resolução': {
		statusCode: 7, icon: 'img/fire.png', defaultActive: true
	}, 'Conclusão': {
		statusCode: 8, icon: 'img/fire.png', defaultActive: false
	}, 'Vigilância': {
		statusCode: 9, icon: 'img/fire.png', defaultActive: false
	}, 'Encerrada': {
		statusCode: 10, icon: 'img/fire.png', defaultActive: false
	}, 'Falso Alarme': {
		statusCode: 11, icon: 'img/fire.png', defaultActive: false
	}, 'Falso Alerta': {
		statusCode: 12, icon: 'img/fire.png', defaultActive: false
	}
};
const overlayLayers = {
	'Ciclo Dia/Noite': {
		id: 'day-night-layer', type: 'fill', source: 'day-night-data', icon: 'img/day_night.png', active: false, category: 'day-night', sourceData: null
	}
};
const baseLayersConfig = {
	'Standard - Default - Dawn': {
		layer: 'mapbox://styles/mapbox/standard', style: 'dawn', theme: 'default'
	}, 'Standard - Default - Day': {
		layer: 'mapbox://styles/mapbox/standard', style: 'day', theme: 'default'
	}, 'Standard - Default - Dusk': {
		layer: 'mapbox://styles/mapbox/standard', style: 'dusk', theme: 'default'
	}, 'Standard - Default - Night': {
		layer: 'mapbox://styles/mapbox/standard', style: 'night', theme: 'default'
	}, 'Standard - Faded - Dawn': {
		layer: 'mapbox://styles/mapbox/standard', style: 'dawn', theme: 'faded'
	}, 'Standard - Faded - Day': {
		layer: 'mapbox://styles/mapbox/standard', style: 'day', theme: 'faded'
	}, 'Standard - Faded - Dusk': {
		layer: 'mapbox://styles/mapbox/standard', style: 'dusk', theme: 'faded'
	}, 'Standard - Faded - Night': {
		layer: 'mapbox://styles/mapbox/standard', style: 'night', theme: 'faded'
	}, 'Standard - Monochrome - Dawn': {
		layer: 'mapbox://styles/mapbox/standard', style: 'dawn', theme: 'monochrome'
	}, 'Standard - Monochrome - Day': {
		layer: 'mapbox://styles/mapbox/standard', style: 'day', theme: 'monochrome'
	}, 'Standard - Monochrome - Dusk': {
		layer: 'mapbox://styles/mapbox/standard', style: 'dusk', theme: 'monochrome'
	}, 'Standard - Monochrome - Night': {
		layer: 'mapbox://styles/mapbox/standard', style: 'night', theme: 'monochrome'
	}, 'Satellite - Dawn': {
		layer: 'mapbox://styles/mapbox/satellite-streets-v12', style: 'dawn'
	}, 'Satellite - Day': {
		layer: 'mapbox://styles/mapbox/satellite-streets-v12', style: 'day'
	}, 'Satellite - Dusk': {
		layer: 'mapbox://styles/mapbox/satellite-streets-v12', style: 'dusk'
	}, 'Satellite - Night': {
		layer: 'mapbox://styles/mapbox/satellite-streets-v12', style: 'night'
	}
};
const baseLayerButtons = {};
let baseLayerButtonsContainer, fireButtonsContainer;

function initializeOverlayLayers() {
	for (const statusName in fireStatusLayers) {
		const statusConfig = fireStatusLayers[statusName];
		overlayLayers[statusName] = {
			id: `fires-status-${statusConfig.statusCode}-layer`, type: 'symbol', source: `fires-status-${statusConfig.statusCode}-data`, icon: statusConfig.icon, active: statusConfig.defaultActive, category: 'fire-status', statusCode: statusConfig.statusCode, sourceData: []
		};
	}
}

function showErrorMessage(message) {
	const errorMessage = document.createElement('div');
	errorMessage.className = 'error-message';
	errorMessage.textContent = message;
	errorContainer.appendChild(errorMessage);
	setTimeout(() => errorMessage.remove(), 5000);
}

function initializeMap() {
	map = new mapboxgl.Map({
		container: 'map',
		style: baseLayersConfig['Standard - Default - Day'].layer,
		projection: 'globe',
		center: [-7.8536599, 39.557191],
		pitch: 0,
		bearing: 0,
		zoom: 6
	});
	map.addControl(new mapboxgl.NavigationControl(), 'top-left');
	map.addControl(new mapboxgl.GeolocateControl({
		positionOptions: {
			enableHighAccuracy: true
		}, trackUserLocation: true, showUserHeading: true
	}), 'top-left');
	map.once('style.load', () => {
		map.setTerrain({
			'exaggeration': 1
		});
	});
	map.on('load', () => {
		initializeLayerBar();
		setupBaseLayerButtons();
		rebuildOverlayControls();
		updateBaseLayerButtonState('Standard - Default - Day');
		updateDayNightLayer();
	});
	map.on('click', () => {
		const previouslyActiveIcon = document.querySelector('.dot-active');
		if (previouslyActiveIcon) {
			previouslyActiveIcon.classList.remove('dot-active');
		}
		hideSidebar();
		window.history.pushState('fogo', '', window.location.href.split('?')[0]);
	});
}

function showSidebar() {
	document.body.classList.add('sidebar-open');
	document.querySelector('.sidebar').classList.add('active');
}

function hideSidebar() {
	document.body.classList.remove('sidebar-open');
	document.querySelector('.sidebar').classList.remove('active');
	map.flyTo({
		center: [-7.8536599, 39.557191],
		pitch: 0,
		bearing: 0,
		zoom: 6
	});
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
			const isOpen = dropdownContainer.classList.contains('open');
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

function setupBaseLayerButtons() {
	if (!baseLayerButtonsContainer) return;
	baseLayerButtonsContainer.innerHTML = '';
	for (const layerName in baseLayersConfig) {
		const button = document.createElement('button');
		button.innerHTML = `<img src='img/map.png' alt='map icon'>${layerName}`;
		button.addEventListener('click', () => {
			const {
				layer, style, theme
			} = baseLayersConfig[layerName];
			const previousActiveLayer = document.querySelector('.dropdown-menu button.active');
			const previousActiveLayerName = previousActiveLayer ? previousActiveLayer.textContent.split('-')[0].trim() : '';
			const newActiveLayerName = layerName.split('-')[0].trim();
			const isStandardStyle = layer.includes('mapbox/standard');
			if (isStandardStyle && previousActiveLayerName === newActiveLayerName) {
				map.setConfigProperty('basemap', 'lightPreset', style);
				map.setConfigProperty('basemap', 'theme', theme);
			} else {
				map.setStyle(layer, {
					config: {
						basemap: {
							lightPreset: style, theme: theme
						}
					}
				});
				map.once('styledata', () => {
					fetchAndApplyDynamicLayers();
					reapplyOverlayLayers();
					rebuildOverlayControls();
					if (overlayLayers['Ciclo Dia/Noite'].active) {
						updateDayNightLayer();
					}
					if (!map.getSource('mapbox-dem')) {
						map.addSource('mapbox-dem', {
							type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14
						});
					}
					map.on('style.load', () => {
						map.setTerrain({
							'source': 'mapbox-dem',
							'exaggeration': 1
						});
					});
				});
			}
			updateBaseLayerButtonState(layerName);
		}, {
			passive: true
		});
		baseLayerButtonsContainer.appendChild(button);
		baseLayerButtons[layerName] = button;
	}
}

const overlayButtons = {};

function rebuildOverlayControls() {
	const containers = [fireButtonsContainer];
	containers.forEach(container => {
		if (container) container.innerHTML = '';
	});
	if (overlayButtons['Ciclo Dia/Noite']) {
		overlayButtons['Ciclo Dia/Noite'].remove();
	}
	for (const key in overlayButtons) {
		delete overlayButtons[key];
	}
	const layerBar = document.getElementById('layer-bar');
	for (const layerKey in overlayLayers) {
		const layerConfig = overlayLayers[layerKey];
		const button = document.createElement('button');
		const iconSrc = layerConfig.icon || 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3C%2Fsvg%3E';
		button.classList.toggle('active', layerConfig.active);
		button.dataset.category = layerConfig.category;
		button.dataset.layerId = layerConfig.id;
		if (layerConfig.statusCode) {
			button.dataset.statusCode = layerConfig.statusCode;
		}
		button.addEventListener('click', () => {
			const { category, layerId, statusCode } = button.dataset;
			let newActiveState = !button.classList.contains('active');
			if (['day-night'].includes(category)) {
				if (button.classList.contains('active')) {
					button.classList.remove('active');
				} else {
					button.classList.add('active');
				}
			}

			layerConfig.active = newActiveState;
			button.classList.toggle('active', newActiveState);
			if (category === 'fire-status') {
				if (allFireMarkersByStatus[statusCode]) {
					allFireMarkersByStatus[statusCode].forEach(marker => {
						marker.getElement().style.display = newActiveState ? 'block' : 'none';
					});
				}
			} else if (category === 'day-night') {
				if (newActiveState) {
					updateDayNightLayer();
				} else {
					if (map.getLayer('day-night-layer')) {
						map.setLayoutProperty('day-night-layer', 'visibility', 'none');
					}
				}
			}
		}, {
			passive: true
		});
		const appendButton = (container) => {
			if (container) container.appendChild(button);
		};
		if (layerConfig.category === 'day-night') {
			button.innerHTML = `<img src='${iconSrc}' srcset='${iconSrc} 18w, ${iconSrc.replace(".png", "_27.png")} 27w' alt='layer icon'>${layerKey}`;
			button.className = 'dropdown-toggle';
			button.classList.toggle('active', layerConfig.active);
			layerBar.appendChild(button);
		} else if (layerConfig.category === 'fire-status') {
			button.innerHTML = `<img src='${iconSrc}' srcset='${iconSrc} 22w, ${iconSrc.replace(".png", "_33.png")} 33w' alt='layer icon'>${layerKey}`;
			appendButton(fireButtonsContainer);
		}
		overlayButtons[layerKey] = button;
	}
}

function calculateDayNightPolygon() {
	const SunCalc = new sunCalc();
	SunCalc.calculate();

	function latitude(lng) {
		return SunCalc.rad2deg(Math.atan(-Math.cos(SunCalc.deg2rad(SunCalc.observer_hour_angle(SunCalc.data.nu, lng, SunCalc.data.alpha))) / Math.tan(SunCalc.deg2rad(SunCalc.data.delta))));
	}

	let latLngs = [];
	let startMinus = -180;
	for (let i = 0; i <= 360; i++) {
		let lng = startMinus + i;
		let lat = latitude(lng);
		latLngs[i + 1] = [lat, lng];
	}
	if (SunCalc.data.delta < 0) {
		latLngs[0] = [90, startMinus];
		latLngs[latLngs.length] = [90, 180];
	} else {
		latLngs[0] = [-90, startMinus];
		latLngs[latLngs.length] = [-90, 180];
	}
	return {
		'type': 'FeatureCollection', 'features': [{
			'type': 'Feature', 'properties': {}, 'geometry': {
				'type': 'Polygon', 'coordinates': [[...latLngs.map(latLng => {
					return [latLng[1], latLng[0]];
				}), [latLngs[0][1], latLngs[0][0]]].slice().reverse()]
			}
		}]
	};
}

function updateDayNightLayer() {
	const dayNightGeoJSON = calculateDayNightPolygon();
	overlayLayers['Ciclo Dia/Noite'].sourceData = dayNightGeoJSON;
	if (overlayLayers['Ciclo Dia/Noite'].active) {
		if (!map.getSource('day-night-data')) {
			map.addSource('day-night-data', {
				type: 'geojson', data: dayNightGeoJSON
			});
			map.addLayer({
				id: 'day-night-layer', type: 'fill', source: 'day-night-data', paint: {
					'fill-color': '#000000', 'fill-opacity': 0.4
				}
			});
		} else {
			map.getSource('day-night-data').setData(dayNightGeoJSON);
		}
		map.setLayoutProperty('day-night-layer', 'visibility', 'visible');
	}
}

function reapplyOverlayLayers() {
	for (const layerKey in overlayLayers) {
		const layerConfig = overlayLayers[layerKey];
		if (layerConfig.active) {
			if (layerConfig.category === 'fire-status') {
				if (allFireMarkersByStatus[layerConfig.statusCode]) {
					allFireMarkersByStatus[layerConfig.statusCode].forEach(marker => marker.getElement().style.display = 'block');
				}
			} else if (layerConfig.category === 'day-night' && layerConfig.active) {
				updateDayNightLayer();
			}
		} else if (layerConfig.category === 'fire-status') {
			if (allFireMarkersByStatus[layerConfig.statusCode]) {
				allFireMarkersByStatus[layerConfig.statusCode].forEach(marker => marker.getElement().style.display = 'none');
			}
		} else if (layerConfig.category === 'day-night') {
			if (map.getLayer('day-night-layer')) {
				map.setLayoutProperty('day-night-layer', 'visibility', 'none');
			}
		}
	}
}

function fetchAndApplyDynamicLayers() {
	currentWorker.postMessage({
		type: 'fireData'
	});
}

function addFireMarker(fire, mapInstance) {
	const {
		lat, lng, id: fireId, statusCode
	} = fire;
	const statusConfig = Object.values(fireStatusLayers).find(s => s.statusCode === statusCode);
	if (!statusConfig) {
		console.warn(`Unknown fire status: ${statusCode}`);
		return;
	}
	if (lat && lng) {
		let iconClass = `dot status-${statusCode}`;
		if (fire.important && [7, 8, 9].includes(statusCode)) {
			iconClass = 'dot status-99-r';
		} else if (fire.important) {
			iconClass = 'dot status-99';
		}
		const urlParams = new URLSearchParams(window.location.search);
		const fireIdFromUrl = urlParams.get('fogo');
		const isInitiallyActive = fireIdFromUrl === fireId.toString();
		if (isInitiallyActive) {
			iconClass += ' dot-active';

			if (isMobile) {
				mapInstance.flyTo({
					center: [lng, lat - 0.25], zoom: 9
				});
			} else {
				mapInstance.flyTo({
					center: [lng, lat], zoom: 9
				});
			}
		}
		const el = document.createElement('div');
		el.className = 'fire-marker';
		el.innerHTML = `<i class='${iconClass}' id='fire-${fireId}'></i>`;
		el.style.width = `${BASE_FIRE_SIZE}px`;
		el.style.height = `${BASE_FIRE_SIZE}px`;
		const layerKey = Object.keys(fireStatusLayers).find(key => fireStatusLayers[key].statusCode === statusCode);
		if (overlayLayers[layerKey] && !overlayLayers[layerKey].active) {
			el.style.display = 'none';
		}
		const marker = new mapboxgl.Marker({
			element: el, anchor: 'center'
		}).setLngLat([lng, lat]).addTo(mapInstance);
		if (!allFireMarkersByStatus[statusCode]) {
			allFireMarkersByStatus[statusCode] = [];
		}
		allFireMarkersByStatus[statusCode].push(marker);
		el.addEventListener('click', (e) => {
			e.stopPropagation();
			const activeIcon = el.querySelector('.dot');
			const previouslyActiveIcon = document.querySelector('.dot-active');
			if (previouslyActiveIcon && previouslyActiveIcon !== activeIcon) {
				previouslyActiveIcon.classList.remove('dot-active');
			}
			activeIcon.classList.add('dot-active');
			if (isMobile) {
				mapInstance.flyTo({
					center: [lng, lat - 0.25], zoom: 9
				});
			} else {
				mapInstance.flyTo({
					center: [lng, lat], zoom: 9
				});
			}
			updateSidebarDetails(fire, lat, lng);
			showSidebar();
			window.history.pushState('fogo', '', `?fogo=${fireId}`);
		}, {
			passive: true
		});
	}
}

function updateSidebarDetails(fire, lat, lng) {
	const locationLink = `<a href='https://www.google.com/maps/search/${lat},${lng}' target='_blank' rel='noopener noreferrer'><i class='fas fa-map-marker-alt'></i> ${lat},${lng}</a>`;
	document.querySelector('.f-local').innerHTML = fire.location;
	document.querySelector('.f-man').textContent = fire.man;
	document.querySelector('.f-aerial').textContent = fire.aerial;
	document.querySelector('.f-terrain').textContent = fire.terrain;
	document.querySelector('.f-location').innerHTML = locationLink;
	document.querySelector('.f-nature').textContent = fire.natureza;
	document.querySelector('.f-update').textContent = fire.updated;
	document.querySelector('.f-start').textContent = fire.startDate;
	fetchFireDetails(fire.id);
}

async function fetchFireDetails(id) {
	await Promise.all([plotFireData(id), fetchAndRenderStatus(id), fetchAndRenderExtra(id)]);
}

async function plotFireData(id) {
	const url = `https://api.fogos.pt/fires/data?id=${id}`;
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const data = await response.json();
		const canvas = document.getElementById('fireChart');
		if (!canvas) {
			console.error('Canvas element #fireChart not found.');
			return;
		}
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
}

async function fetchAndRender(url, selector, toggleClass = null) {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		let data = await response.text();
		const element = document.querySelector(selector);
		const parentRow = element ? element.closest('.card') : null;
		if (data && (data.trim().length > 2)) {
			element.innerHTML = data.replace(/\s<img[\s\S]*\/>/, '');;
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
}

const fetchAndRenderStatus = (id) => fetchAndRender(`https://fogos.pt/views/status/${id}`, '.f-status');
const fetchAndRenderExtra = (id) => fetchAndRender(`https://fogos.pt/views/extra/${id}`, '.f-extra', 'active');

function checkAllDataProcessed() {
	loader.style.display = 'none';
	const urlParams = new URLSearchParams(window.location.search);
	const fireIdFromUrl = urlParams.get('fogo');
	if (fireIdFromUrl) {
		setTimeout(() => {
			const targetMarkerElement = document.getElementById(`fire-${fireIdFromUrl}`);
			if (targetMarkerElement) {
				targetMarkerElement.click();
			}
		}, 500);
	}
}

function setupWorker() {
	if (currentWorker) {
		return;
	}
	loader.style.display = 'block';
	loader.innerText = 'A inicializar processamento de dados...';
	currentWorker = new Worker('js/worker.js');
	currentWorker.onmessage = (e) => {
		const {
			type, message, data
		} = e.data;
		if (type === 'progress') {
			loader.innerText = message;
		} else if (type === 'fireDataComplete') {
			loader.innerText = 'A adicionar novos dados de ocorrências...';
			for (const statusCode in allFireMarkersByStatus) {
				allFireMarkersByStatus[statusCode].forEach(marker => marker.remove());
			}
			allFireMarkersByStatus = {};
			data.forEach(fire => addFireMarker(fire, map));
			checkAllDataProcessed();
			rebuildOverlayControls();
		} else if (type === 'error') {
			showErrorMessage(message);
			checkAllDataProcessed();
		}
	};
	currentWorker.onerror = (e) => {
		console.error('Worker error:', e);
		showErrorMessage('Ocorreu um erro crítico no worker. Verifique a consola para detalhes.');
		checkAllDataProcessed();
	};
}

window.onload = async () => {
	initializeOverlayLayers();
	initializeMap();
	setupWorker();
	await currentWorker.postMessage({
		type: 'fireData', url: window.location.href.split('?')[0]
	});
};