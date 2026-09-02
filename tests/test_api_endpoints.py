from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get('/api/v1/health')
    assert res.status_code == 200
    assert res.json()['status'] == 'ok'

def test_health_detailed():
    res = client.get('/api/v1/health/detailed')
    assert res.status_code == 200
    data = res.json()
    assert data['status'] == 'ok'
    assert 'solver' in data
    assert 'solver_version' in data
    assert data['zone'] == 'NR/NCR'

def test_login_and_analytics_summary():
    login_res = client.post('/api/v1/auth/login', json={
        'email': 'admin@railways.gov.in',
        'password': 'admin12345'
    })
    assert login_res.status_code == 200
    token = login_res.json()['access_token']
    
    analytics_res = client.get('/api/v1/analytics/summary', headers={
        'Authorization': f'Bearer {token}'
    })
    assert analytics_res.status_code == 200
    summary = analytics_res.json()
    assert 'total_tasks' in summary
    assert 'coverage_pct' in summary
    assert 'severity_breakdown' in summary
