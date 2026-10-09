"""Export computed Golden fixture for the frontend contract test; run from root."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.main import get_golden_corridor_demo, DEMO_RIDERS
Path(__file__).with_name('dispatch_fixture.json').write_text(json.dumps({'dispatch': get_golden_corridor_demo(), 'requests': DEMO_RIDERS}), encoding='utf-8')
