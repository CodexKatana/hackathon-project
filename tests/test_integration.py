"""Run from project root: python -m unittest discover -s tests -v"""
import unittest
from fastapi.testclient import TestClient
from backend import main


class AppIntegrationTests(unittest.TestCase):
    def setUp(self):
        main.booking_queue.clear()
        self.client = TestClient(main.app)

    def post_booking(self, name, origin, destination):
        return self.client.post('/api/rides/book', json={
            'request_id': name, 'passenger_name': name,
            'origin_name': origin, 'destination_name': destination,
            'seats_requested': 1, 'max_detour_percent': 15,
        })

    def test_health(self):
        r = self.client.get('/api/health')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['status'], 'HEALTHY')

    def test_demo_and_dispatch(self):
        r = self.client.post('/api/demo/load-golden-queue')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['queue_size'], 3)
        r = self.client.post('/api/rides/batch/dispatch-now')
        self.assertEqual(r.status_code, 200)
        d = r.json()['dispatch']
        self.assertTrue(d['is_feasible'])
        self.assertEqual(len(d['route_summary']['stops']), 6)
        self.assertEqual(d['route_summary']['distance_saved_km'], 79)
        self.assertEqual(d['pricing']['platform_deficit_paise'], 0)
        self.assertAlmostEqual(sum(d['pricing']['comparative_splits']['shapley_fares_inr'].values()), 2100)
        self.assertEqual(self.client.get('/api/rides/queue').json()['queue_size'], 0)

    def test_custom_booking_round_trip(self):
        r = self.post_booking('Test Rider', 'Pune Kiwale Entry', 'Panvel Highway Exit')
        self.assertEqual(r.status_code, 201)
        d = self.client.post('/api/rides/batch/dispatch-now')
        self.assertEqual(d.status_code, 200)
        self.assertEqual(d.json()['dispatch']['pricing']['platform_deficit_paise'], 0)

    def test_reverse_direction_rejected(self):
        r = self.post_booking('Wrong Way', 'Mumbai Dadar TT Circle', 'Pune Kiwale Entry')
        self.assertEqual(r.status_code, 400)

    def test_no_overlap_rejected_without_losing_queue(self):
        self.post_booking('First', 'Pune Kiwale Entry', 'Lonavala Interchange')
        self.post_booking('Second', 'Panvel Highway Exit', 'Mumbai Dadar TT Circle')
        r = self.client.post('/api/rides/batch/dispatch-now')
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self.client.get('/api/rides/queue').json()['queue_size'], 2)

    def test_invalid_same_stops(self):
        r = self.post_booking('Same', 'Pune Kiwale Entry', 'Pune Kiwale Entry')
        self.assertEqual(r.status_code, 400)

    def test_websocket(self):
        with self.client.websocket_connect('/ws/corridor') as ws:
            data = ws.receive_json()
            self.assertEqual(data['event'], 'BATCH_TICK')
            self.assertEqual(data['data']['queue_size'], 0)

if __name__ == '__main__':
    unittest.main()
