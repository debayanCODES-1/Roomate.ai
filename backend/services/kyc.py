import hashlib
import os
from dataclasses import dataclass
from typing import Protocol

import httpx


@dataclass(frozen=True)
class VerifiedIdentity:
    reference_id: str
    gender: str
    age: int


class KycProvider(Protocol):
    async def verify(self, authorization_code: str | None, *, mock_gender: str | None = None,
                     mock_age: int | None = None) -> VerifiedIdentity: ...


class SandboxKycProvider:
    async def verify(self, authorization_code: str | None, *, mock_gender: str | None = None,
                     mock_age: int | None = None) -> VerifiedIdentity:
        if not authorization_code or not authorization_code.startswith("sandbox-"):
            raise ValueError("Sandbox verification requires a sandbox- authorization code.")
        if mock_gender not in {"woman", "man", "non_binary"}:
            raise ValueError("Choose a supported verified gender for the sandbox simulation.")
        if mock_age is None or not 18 <= mock_age <= 100:
            raise ValueError("Sandbox verification is available only for ages 18 through 100.")
        return VerifiedIdentity(reference_id=authorization_code, gender=mock_gender, age=mock_age)


class OAuthKycProvider:
    async def verify(self, authorization_code: str | None, *, mock_gender: str | None = None,
                     mock_age: int | None = None) -> VerifiedIdentity:
        if not authorization_code:
            raise ValueError("A provider authorization code is required.")
        token_url = os.getenv("KYC_OAUTH_TOKEN_URL", "")
        identity_url = os.getenv("KYC_OAUTH_IDENTITY_URL", "")
        client_id = os.getenv("KYC_OAUTH_CLIENT_ID", "")
        client_secret = os.getenv("KYC_OAUTH_CLIENT_SECRET", "")
        if not all((token_url, identity_url, client_id, client_secret)):
            raise RuntimeError("OAuth KYC is selected but provider credentials are not configured.")

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                token_response = await client.post(
                    token_url,
                    data={
                        "grant_type": "authorization_code",
                        "code": authorization_code,
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "scope": os.getenv("KYC_OAUTH_SCOPE", "openid profile"),
                    },
                )
                token_response.raise_for_status()
                token_data = token_response.json()
                if not isinstance(token_data, dict):
                    raise RuntimeError("KYC token response must be a JSON object.")
                access_token = token_data.get("access_token")
                if not access_token:
                    raise RuntimeError("KYC token response did not include an access token.")
                identity_response = await client.get(
                    identity_url, headers={"Authorization": f"Bearer {access_token}"}
                )
                identity_response.raise_for_status()
                identity = identity_response.json()
                if not isinstance(identity, dict):
                    raise RuntimeError("KYC identity response must be a JSON object.")
            except httpx.HTTPStatusError as exc:
                raise RuntimeError(f"KYC provider returned HTTP {exc.response.status_code}.") from exc
            except httpx.RequestError as exc:
                raise RuntimeError("Could not reach the configured KYC provider.") from exc
            except ValueError as exc:
                raise RuntimeError("KYC provider returned invalid JSON.") from exc

        reference_id = identity.get("reference_id") or identity.get("sub")
        gender = identity.get("verified_gender")
        age = identity.get("verified_age")
        if not reference_id or gender not in {"woman", "man", "non_binary"} or not isinstance(age, int):
            raise RuntimeError("KYC provider returned an incomplete or unsupported verified identity.")
        if not 18 <= age <= 100:
            raise RuntimeError("KYC provider reported an age outside the supported adult range.")
        return VerifiedIdentity(reference_id=str(reference_id), gender=gender, age=age)


def get_kyc_provider() -> KycProvider:
    mode = os.getenv("KYC_MODE", "sandbox").lower()
    if mode == "sandbox":
        return SandboxKycProvider()
    if mode == "oauth":
        return OAuthKycProvider()
    raise RuntimeError("KYC_MODE must be either 'sandbox' or 'oauth'.")


def hash_reference_id(reference_id: str) -> str:
    return hashlib.sha256(reference_id.encode("utf-8")).hexdigest()
