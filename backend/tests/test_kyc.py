import unittest

from backend.services.kyc import SandboxKycProvider, hash_reference_id


class SandboxKycTests(unittest.IsolatedAsyncioTestCase):
    async def test_sandbox_returns_only_verified_identity_attributes(self):
        identity = await SandboxKycProvider().verify(
            "sandbox-test-subject",
            mock_gender="woman",
            mock_age=26,
        )
        self.assertEqual(identity.gender, "woman")
        self.assertEqual(identity.age, 26)
        self.assertEqual(hash_reference_id(identity.reference_id), hash_reference_id("sandbox-test-subject"))

    async def test_sandbox_rejects_non_sandbox_authorization_code(self):
        with self.assertRaises(ValueError):
            await SandboxKycProvider().verify(
                "123456789012",
                mock_gender="woman",
                mock_age=26,
            )

    async def test_sandbox_requires_supported_gender_and_adult_age(self):
        with self.assertRaises(ValueError):
            await SandboxKycProvider().verify(
                "sandbox-test-subject",
                mock_gender="unknown",
                mock_age=26,
            )
        with self.assertRaises(ValueError):
            await SandboxKycProvider().verify(
                "sandbox-test-subject",
                mock_gender="woman",
                mock_age=17,
            )


if __name__ == "__main__":
    unittest.main()
