// Converts the original optimization engine's JSON into the shape used by the UI.
// There are no invented ride distances, fares or detour percentages here.
const nodeNames = {
  Pune: 'Pune Kiwale Entry', Talegaon: 'Talegaon Toll Plaza',
  Lonavala: 'Lonavala Interchange', Khandala: 'Khandala Ghat',
  Khalapur: 'Khalapur Toll Plaza', Panvel: 'Panvel Highway Exit',
  Vashi: 'Vashi (Navi Mumbai)', Mumbai: 'Mumbai Dadar TT Circle',
};

export const getError = async (response) => {
  const data = await response.json().catch(() => ({}));
  return typeof data.detail === 'string' ? data.detail : data.detail?.message || data.error || `Request failed (${response.status})`;
};

export function formatQueuedRider(booking) {
  return {
    id: booking.request_id,
    name: booking.passenger_name,
    origin: booking.origin_name,
    destination: booking.destination_name,
    seats: booking.seats_requested,
    directDistKm: booking.direct_distance_km ?? 0,
    shapleyFare: null, // Not available until the backend dispatches the batch.
    savingsPercent: null,
  };
}

export function normalizeDispatch(result, requests = []) {
  if (!result?.is_feasible || !result.route_summary || !result.pricing) {
    throw new Error('Backend returned no feasible optimized route.');
  }
  const route = result.route_summary;
  const prices = result.pricing;
  const splits = prices.comparative_splits;
  const breakdowns = prices.shapley_breakdown;
  const metrics = result.detour_compliance.rider_metrics;
  const riderNames = Object.keys(splits.shapley_fares_inr);
  const commuters = riderNames.map((name) => {
    const b = breakdowns[name];
    const m = metrics[name];
    const soloFare = b.baseline_solo_fare;
    const shapleyFare = splits.shapley_fares_inr[name];
    return {
      id: `backend-${name}`,
      name,
      origin: nodeNames[b.pickup] || b.pickup,
      destination: nodeNames[b.dropoff] || b.dropoff,
      seats: requests.find(r => r.passenger_name === name)?.seats_requested ?? 1,
      pickupNode: b.pickup,
      dropoffNode: b.dropoff,
      directDistKm: m.direct_distance_km,
      directTimeMin: m.direct_time_min,
      actualTimeMin: m.in_cab_time_min,
      detourMin: Math.max(0, m.in_cab_time_min - m.direct_time_min),
      detourPercent: m.detour_pct,
      soloFare,
      equalSplitFare: splits.equal_split_inr[name],
      distanceSplitFare: splits.distance_proportional_inr[name],
      shapleyFare,
      savingsAmount: Number((soloFare - shapleyFare).toFixed(2)),
      savingsPercent: soloFare > 0 ? Number(((soloFare - shapleyFare) / soloFare * 100).toFixed(1)) : 0,
      status: m.is_compliant ? 'PASS <= 15%' : 'FAIL > 15%',
      shapleyExplanation: (b.plain_english_reasons || []).join(' '),
    };
  });
  const stops = [];
  let occupied = 0;
  for (const entry of route.stops) {
    const seats = requests.find(r => r.passenger_name === entry.rider_id)?.seats_requested ?? 1;
    occupied += entry.stop_type === 'PICKUP' ? seats : -seats;
    const previous = stops[stops.length - 1];
    const location = nodeNames[entry.location] || entry.location;
    if (previous && previous.km === entry.km_coordinate && previous.type === 'DROPOFF' && entry.stop_type === 'PICKUP') {
      previous.type = 'SWAP';
      previous.rider = `Drop ${previous.rider} / Pick ${entry.rider_id}`;
      previous.seatsOccupied = occupied;
    } else {
      stops.push({
        stopNum: stops.length + 1,
        type: entry.stop_type,
        rider: entry.rider_id,
        node: location,
        lat: entry.lat,
        lng: entry.lng,
        km: entry.km_coordinate,
        seatsOccupied: occupied,
      });
    }
  }
  return {
    scenarioName: 'Pune–Mumbai Expressway (computed by Python backend)',
    summary: {
      totalPooledDistanceKm: route.pooled_distance_km,
      totalSoloDistanceKm: route.unpooled_total_distance_km,
      distanceSavedKm: route.distance_saved_km,
      distanceSavedPercent: route.distance_saved_pct,
      co2SavedKg: route.co2_saved_kg,
      totalFareCollected: prices.total_pooled_fare_inr,
      driverPayout: prices.total_pooled_fare_inr,
      platformDeficitPaise: prices.platform_deficit_paise,
      activeStopsCount: stops.length,
    },
    commuters,
    stops,
    routeCoordinates: route.leaflet_waypoints,
  };
}

export function normalizeBenchmark(data) {
  return {
    totalRiders: data.total_commuters_simulated,
    vktSavedPercent: -data.distance_reduction_pct,
    vktSavedKm: Number((data.unpooled_total_distance_km - data.optimized_pooled_distance_km).toFixed(2)),
    p95DetourPercent: data.p95_detour_pct,
    slaCompliancePercent: data.max_detour_pct <= 15 ? 100 : 0,
    co2SavedKg: data.co2_reduction_kg,
    driverRevenueBoostPercent: data.driver_revenue_boost_pct,
    platformDeficitPaise: data.platform_deficit_paise,
    averageOccupancy: null,
    matchRatePercent: null,
    averagePickupDelayMin: null,
    histogram: null,
  };
}
