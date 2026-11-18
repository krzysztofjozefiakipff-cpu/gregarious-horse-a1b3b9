"""Regression fixtures from three real JAECOO 8 offline V17 runs.

Tests pair-selection decisions only, not actual wheel detection accuracy.
"""
import unittest
from photo_wheels import select_side_wheel_pair


def c(x, y, r):
    return {"x": x, "y": y, "radius": r,
            "silhouette_bottom_gap_radius_ratio": .2}


class SideWheelPairRegression(unittest.TestCase):
    def test_side_retains_real_pair(self):
        points = [c(1105,317,74), c(254,400,69), c(957,400,68)]
        self.assertEqual(select_side_wheel_pair(points, 1100), [2,3])

    def test_front_rejects_high_false_pair(self):
        points = [c(671,555,86), c(405,419,123), c(832,353,123)]
        self.assertIsNone(select_side_wheel_pair(points, 1100))

    def test_rear_rejects_high_false_pair(self):
        points = [c(928,465,94), c(519,549,70), c(759,415,80),
                  c(623,471,120), c(645,346,119), c(215,340,111)]
        self.assertIsNone(select_side_wheel_pair(points, 1100))

    def test_no_candidates(self):
        self.assertIsNone(select_side_wheel_pair([], 1000))


if __name__ == "__main__":
    unittest.main()
