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

if __name__ == '__main__':
    unittest.main()
