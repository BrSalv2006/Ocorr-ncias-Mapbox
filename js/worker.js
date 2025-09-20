const now = new Date();

const fetchWithRetry = async (url, options = {}, retries = 3, delay = 1000) => {
	for (let i = 0; i < retries; i++) {
		try {
			const response = await fetch(url, options);
			if (!response.ok) {
				if (response.status === 429 && i < retries) {
					await new Promise(resolve => setTimeout(resolve, delay));
					continue;
				}
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			return await response.json();
		} catch (error) {
			if (i < retries) {
				await new Promise(resolve => setTimeout(resolve, delay));
			} else {
				throw error;
			}
		}
	}
};

const handlers = {
	fireData: async () => {
		const url = 'https://api.fogos.pt/v2/incidents/active?all=true';
		const response = await fetchWithRetry(url);

		if (!response?.success) {
			return;
		}

		const processedFires = response.data.map(properties => {
			const start = new Date(properties.created.sec);
			const timeElapsed = (now - start) / 3600000;
			return {
				id: properties.id,
				lat: properties.lat,
				lng: properties.lng,
				statusCode: properties.statusCode,
				man: properties.man,
				aerial: properties.aerial,
				terrain: properties.terrain,
				location: properties.location,
				natureza: properties.natureza,
				status: properties.status,
				startDate: new Date(properties.dateTime.sec * 1000).toLocaleString(),
				updated: new Date(properties.updated.sec * 1000).toLocaleString(),
				important: (properties.terrain > 15 || properties.aerial > 0) && timeElapsed >= 3,
			};
		});

		self.postMessage({ type: 'fireDataComplete', data: processedFires });
	}
};

self.onmessage = async ({ data }) => {
	const handler = handlers[data.type];
	if (handler) {
		try {
			await handler(data);
		} catch (err) {
			console.error(err);
		}
	}
};