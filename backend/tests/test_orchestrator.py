import unittest

from backend.agents.orchestrator import lifestyle_embedding, orchestrator


def person(gender: str, allow_coed_living: bool = False, verified: bool = True):
    profile = {
        "sleep_time": "23:00",
        "wake_time": "07:00",
        "sleeper_type": "average",
        "cleaning_frequency": "weekends",
        "work_mode": "hybrid",
        "food": "veg",
    }
    return {
        "name": "Test",
        "is_kyc_verified": verified,
        "verified_gender": gender,
        "verified_age": 25,
        "allow_coed_living": allow_coed_living,
        "min_rent_budget": 10000,
        "max_rent_budget": 16000,
        "deposit_budget": 30000,
        "utilities_share": True,
        "commute_location": "Bengaluru",
        "commute_lat": 12.93,
        "commute_lng": 77.62,
        "max_commute_km": 15,
        "profile": profile,
        "lifestyle_embedding": lifestyle_embedding(profile),
    }


class OrchestratorTests(unittest.TestCase):
    def evaluate(self, left, right):
        return orchestrator.invoke({"task": "match", "user": left, "candidate": right})

    def test_gender_mismatch_requires_both_people_to_opt_in(self):
        result = self.evaluate(person("woman", allow_coed_living=True), person("man"))
        self.assertFalse(result["eligible"])
        self.assertNotIn("report", result)

        result = self.evaluate(person("woman", allow_coed_living=True), person("man", allow_coed_living=True))
        self.assertTrue(result["eligible"])
        self.assertIn("report", result)

    def test_unverified_person_is_blocked_before_scoring(self):
        result = self.evaluate(person("woman", verified=False), person("woman"))
        self.assertFalse(result["eligible"])
        self.assertNotIn("report", result)

    def test_same_verified_gender_does_not_require_coed_opt_in(self):
        result = self.evaluate(person("woman"), person("woman"))
        self.assertTrue(result["eligible"])
        self.assertEqual(len(result["report"]["green_flags"]), 3)
        self.assertGreaterEqual(result["report"]["match_percentage"], 0)
        self.assertLessEqual(result["report"]["match_percentage"], 100)

    def test_deposit_and_utility_preferences_are_evaluated(self):
        left, right = person("woman"), person("woman")
        left["deposit_budget"] = 1000
        left["utilities_share"] = False
        result = self.evaluate(left, right)
        self.assertEqual(result["deposit_compatibility"], 6)
        self.assertEqual(result["utility_compatibility"], 40)
        self.assertTrue(any("deposit budgets" in item for item in result["report"]["potential_friction"]))
        self.assertTrue(any("utility costs" in item for item in result["report"]["potential_friction"]))

    def test_onboarding_extracts_non_veg_and_household_habits(self):
        result = orchestrator.invoke({
            "task": "onboard",
            "profile": {},
            "message": "I work from home, sleep at 1 am, clean on weekends, eat non-veg, "
                       "dishes can wait till next day, friends can visit with notice and I don't smoke.",
        })
        self.assertEqual(result["profile"]["food"], "non_veg")
        self.assertEqual(result["profile"]["work_mode"], "wfh")
        self.assertEqual(result["profile"]["cleaning_frequency"], "weekends")
        self.assertEqual(result["profile"]["dishwashing_tolerance"], "next_day")
        self.assertEqual(result["profile"]["guests"], "Friends with notice")
        self.assertEqual(result["profile"]["smoking"], "no")
        self.assertEqual(result["profile"]["sleep_time"], "1 am")


if __name__ == "__main__":
    unittest.main()
