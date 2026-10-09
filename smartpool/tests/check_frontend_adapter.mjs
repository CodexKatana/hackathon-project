// First run: python tests/export_fixture.py
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeDispatch } from '../frontend/src/apiAdapter.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./dispatch_fixture.json',import.meta.url)));
const trip=normalizeDispatch(fixture.dispatch,fixture.requests);
assert.equal(trip.commuters.reduce((s,r)=>s+r.shapleyFare,0),2100);
assert.deepEqual(trip.commuters.map(r=>r.shapleyFare),[504,728,868]);
assert.equal(Math.max(...trip.stops.map(s=>s.seatsOccupied)),2);
assert.equal(trip.stops.at(-1).seatsOccupied,0);
assert.equal(trip.stops.length,5);
assert.ok(trip.commuters.every(r=>r.pickupNode && r.dropoffNode && r.detourPercent<=15));
const seats=normalizeDispatch(fixture.dispatch,fixture.requests.map(r=>({...r,seats_requested:r.passenger_name==='Rahul'?2:1})));
assert.equal(seats.commuters.find(r=>r.name==='Rahul').seats,2);
assert.equal(Math.max(...seats.stops.map(s=>s.seatsOccupied)),3);
assert.throws(()=>normalizeDispatch({is_feasible:false}));
console.log('PASS: adapter fares, route, detour fields, multi-seat occupancy, infeasible guard');
