import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from calculations import (
    calculate_phase_angle,
    get_biva_interpretation,
    calculate_scores,
    analyze_hydration,
    analyze_visceral_fat,
    calculate_energy,
    build_clinical_report
)
from reference import (
    get_phase_angle_percentile,
    get_smm_percentile,
    analyze_segmental,
    analyze_composition_indices
)
from app import app, _clean_str, _run_analysis


class TestVitaMetrixCore(unittest.TestCase):

    def test_biva_and_phase_angle(self):
        # Caso típico: R=575.6, Xc=59.0 -> PhA approx 5.85°
        pa = calculate_phase_angle(575.6, 59.0)
        self.assertAlmostEqual(pa, 5.85, delta=0.05)
        
        # Casos borde
        self.assertEqual(calculate_phase_angle(0, 50), 0.0)
        self.assertEqual(calculate_phase_angle(-10, 50), 0.0)

    def test_hydration_analysis(self):
        res = analyze_hydration(tbw=40.0, ecw=16.0, weight=70.0)
        self.assertTrue(res['available'])
        self.assertEqual(res['ecw_tbw_ratio'], 40.0)
        self.assertFalse(res['alert'])

        # Edema
        res_edema = analyze_hydration(tbw=40.0, ecw=19.0, weight=70.0)
        self.assertTrue(res_edema['alert'])
        self.assertEqual(res_edema['status'], "Edema subclínico / Inflamación sistémica")

    def test_energy_calculations(self):
        # Mifflin fallback
        en = calculate_energy(weight=70, height=175, age=30, gender='male', pal=1.4)
        self.assertGreater(en['ree_kcal'], 1500)
        self.assertEqual(en['tee_kcal'], int(round(en['ree_kcal'] * 1.4)))

        # Cunningham con masa grasa (LBM = 70 - 14 = 56kg -> 500 + 22*56 = 1732)
        en_cun = calculate_energy(weight=70, height=175, age=30, gender='male', pal=1.5, fat_mass=14.0)
        self.assertEqual(en_cun['ree_kcal'], 1732)

    def test_composition_indices(self):
        ci = analyze_composition_indices(weight=70, height=175, fat_mass=14.0, smm=30.0, gender='male')
        self.assertTrue(ci['available'])
        self.assertEqual(ci['imc'], 22.9)
        self.assertEqual(ci['imc_status'][0], 'Normal')
        self.assertEqual(ci['fm_pct'], 20.0)

    def test_segmental_asymmetry_formula(self):
        # Brazos: 2.2 kg vs 2.6 kg. Promedio = 2.4 kg. Diferencia = 0.4. 0.4/2.4 = 16.7% (alerta > 10%)
        seg_data = {
            'arm_right': 2.6, 'arm_left': 2.2,
            'torso': 20.0, 'leg_right': 7.0, 'leg_left': 7.0
        }
        res = analyze_segmental(seg_data, gender='male')
        self.assertEqual(len(res['asymmetries']), 1)
        self.assertAlmostEqual(res['asymmetries'][0]['diff_pct'], 16.7, delta=0.2)

    def test_sanitization_and_security(self):
        dirty = "<script>alert('xss')</script> Juan"
        cleaned = _clean_str(dirty)
        self.assertNotIn("<script>", cleaned)
        self.assertIn("&lt;script&gt;", cleaned)

    def test_flask_security_headers_and_health(self):
        client = app.test_client()
        response = client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertIn('X-Content-Type-Options', response.headers)
        self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response.headers['X-Frame-Options'], 'SAMEORIGIN')

    def test_run_analysis_fallback_age(self):
        res = _run_analysis({
            "resistance": 550, "reactance": 55, "weight": 70, "height": 170, "age": 0
        })
        self.assertGreater(res['ree_kcal'], 1000)
        self.assertIsNotNone(res['phase_percentile'])


if __name__ == '__main__':
    unittest.main()
